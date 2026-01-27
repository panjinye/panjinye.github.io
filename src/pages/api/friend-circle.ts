import type { APIRoute } from "astro";

interface FriendLink {
	title: string;
	url: string;
	image: string;
	description: string;
	type: string;
	feed?: string;
}

// 缓存对象，存储RSS解析结果
const rssCache: Map<string, { data: any; timestamp: number }> = new Map();
// 缓存有效期：10分钟
const CACHE_DURATION = 10 * 60 * 1000;

export const GET: APIRoute = async ({ request }) => {
	// 从请求头或查询参数中获取语言，默认使用 zh-cn
	const url = new URL(request.url);
	const locale = url.searchParams.get('locale') || "zh-cn";
	const refresh = url.searchParams.get('refresh') === 'true'; // 检查是否需要强制刷新

	// 尝试加载指定语言的链接列表，如果失败则回退到 zh-cn
	let links: FriendLink[] = [];
	try {
		const linksModule = await import(`../../content/information/${locale}/linkroll.mdx`);
		links = linksModule.links || [];
	} catch {
		// 加载默认语言
		const linksModule = await import(`../../content/information/zh-cn/linkroll.mdx`);
		links = linksModule.links || [];
	}

	// 限制并发请求数量，避免过多请求导致的性能问题
	const maxConcurrentRequests = 10;
	const feedResults = [];

	// 分批次处理友链
	for (let i = 0; i < links.length; i += maxConcurrentRequests) {
		const batch = links.slice(i, i + maxConcurrentRequests);
		const batchPromises = batch.map(async (link) => {
			// 生成缓存键
			const cacheKey = `${link.url}_${link.feed || 'default'}`;
			const now = Date.now();

			// 检查缓存是否有效，如果需要强制刷新则忽略缓存
			if (!refresh && rssCache.has(cacheKey)) {
				const cached = rssCache.get(cacheKey);
				if (cached && now - cached.timestamp < CACHE_DURATION) {
					return cached.data;
				}
			}

			try {
				// 优先使用友链中指定的 feed 地址
				const feedUrls = link.feed ? 
					[link.feed] : // 如果有指定 feed 地址，只尝试这一个
					[
						`${link.url}feed.xml`,
						`${link.url}feed`,
						`${link.url}atom.xml`,
						`${link.url}rss.xml`,
						`${link.url}feed.atom`,
						`${link.url}index.xml`
					];

				// 并行请求所有 feed 地址，设置 3 秒超时
				const fetchPromises = feedUrls.map(async (feedUrl) => {
					try {
						const controller = new AbortController();
						const timeoutId = setTimeout(() => controller.abort(), 3000);
						
						const response = await fetch(feedUrl, {
							headers: {
								"User-Agent": "Mozilla/5.0 (compatible; FriendCircle/1.0)",
								"Cache-Control": "max-age=300" // 允许中间缓存5分钟
							},
							signal: controller.signal
						});
						
						clearTimeout(timeoutId);
						
						if (response.ok) {
							const text = await response.text();
							return { success: true, content: text };
						}
						return { success: false };
					} catch {
						return { success: false };
					}
				});

				// 等待所有请求完成
				const results = await Promise.all(fetchPromises);

				// 查找第一个成功的请求
				for (const result of results) {
					if (result.success && result.content) {
						const items = parseRSS(result.content, link);
						if (items.length > 0) {
							const result = {
								site: link,
								items: items.slice(0, 5)
							};
							// 更新缓存
							rssCache.set(cacheKey, { data: result, timestamp: now });
							return result;
						}
					}
				}

				return {
					site: link,
					items: []
				};
			} catch {
				return {
					site: link,
					items: []
				};
			}
		});

		const batchResults = await Promise.all(batchPromises);
		feedResults.push(...batchResults);
	}

	const successfulSites = feedResults.filter((r) => r.items.length > 0);

	// 根据是否强制刷新设置不同的缓存策略
	const cacheControl = refresh 
		? "no-store, must-revalidate" // 强制刷新时不缓存
		: "public, max-age=600"; // 否则缓存10分钟

	return new Response(JSON.stringify({
		total: links.length,
		fetched: feedResults.length,
		success: successfulSites.length,
		sites: feedResults
	}), {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": cacheControl
		}
	});
};

function parseRSS(xml: string, site: FriendLink) {
	const items: Array<{
		title: string;
		link: string;
		description: string;
		pubDate: string;
	}> = [];

	try {
		// 使用正则表达式解析 RSS，避免使用 DOMParser（浏览器 API）
		// 匹配所有的 entry 或 item 元素
		const entryRegex = /<(entry|item)[^>]*>([\s\S]*?)<\/(entry|item)>/gi;
		let match: RegExpExecArray | null;

		while ((match = entryRegex.exec(xml)) !== null) {
			const entryContent = match[2];

			// 解析标题
			const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;
			const titleMatch = titleRegex.exec(entryContent);
			const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';

			// 解析链接
			const linkRegex = /<link[^>]*href=["']([^"']+)["'][^>]*>|<link[^>]*>([^<]+)<\/link>/i;
			const linkMatch = linkRegex.exec(entryContent);
			let link = linkMatch ? (linkMatch[1] || linkMatch[2] || '').trim() : '';

			// 解析描述
			const descRegex = /<(description|summary|content)[^>]*>([\s\S]*?)<\/(description|summary|content)>/i;
			const descMatch = descRegex.exec(entryContent);
			const description = descMatch ? descMatch[2].replace(/<[^>]*>/g, '').trim() : '';

			// 解析发布日期
			const dateRegex = /<(published|updated|date|pubDate)[^>]*>([\s\S]*?)<\/(published|updated|date|pubDate)>/i;
			const dateMatch = dateRegex.exec(entryContent);
			const pubDate = dateMatch ? dateMatch[2].trim() : '';

			if (title && link) {
				// 确保链接是完整的 URL
				if (!link.startsWith('http')) {
					link = `${site.url}${link.startsWith('/') ? '' : '/'}${link}`;
				}

				items.push({
					title,
					link,
					description: stripHtml(description).slice(0, 200),
					pubDate
				});
			}
		}
	} catch (err) {
		console.error("Failed to parse RSS feed:", err);
	}

	return items;
}

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, "")
		.replace(/\s+/g, " ")
		.trim();
}
