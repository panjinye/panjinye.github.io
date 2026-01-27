<script lang="ts">
import { onMount } from "svelte";
import { fade, fly } from "svelte/transition";
import { getRelativeLocaleUrl } from "astro:i18n";
import i18nit from "$i18n";
import Icon from "$components/Icon.svelte";

interface FriendLink {
	title: string;
	url: string;
	image: string;
	description: string;
	type: string;
}

interface FeedItem {
	title: string;
	link: string;
	description: string;
	pubDate: string;
	site?: FriendLink;
}

interface SiteData {
	site: FriendLink;
	items: FeedItem[];
}

let { locale }: { locale: string } = $props();

const t = $derived(i18nit(locale));

let loading = $state(true);
let sites = $state<SiteData[]>([]);
let allItems = $state<FeedItem[]>([]);
let error = $state<string | null>(null);
let visitedLinks = $state<Set<string>>(new Set());

// 从localStorage加载已访问链接
function loadVisitedLinks() {
	try {
		const saved = localStorage.getItem("visitedFriendLinks");
		if (saved) {
			visitedLinks = new Set(JSON.parse(saved));
		}
	} catch (err) {
		console.error("Failed to load visited links:", err);
	}
}

// 保存已访问链接到localStorage
function saveVisitedLinks() {
	try {
		localStorage.setItem("visitedFriendLinks", JSON.stringify([...visitedLinks]));
	} catch (err) {
		console.error("Failed to save visited links:", err);
	}
}

// 标记链接为已访问
function markAsVisited(link: string) {
	// 直接修改集合，触发响应式更新
	visitedLinks.add(link);
	saveVisitedLinks();
	// 强制刷新状态，确保UI更新
	visitedLinks = new Set(visitedLinks);
}

async function fetchFriendCircle() {
	try {
		loading = true;
		error = null;
		
		// 发起请求，强制刷新数据
		const response = await fetch(`/api/friend-circle?refresh=true&locale=${locale}`, {
			headers: {
				"Cache-Control": "no-store, must-revalidate" // 确保不使用任何缓存
			}
		});
		
		if (!response.ok) {
			throw new Error("Failed to fetch friend circle data");
		}
		
		const data = await response.json();
		let rawSites = data.sites || [];
		
		// 处理每个站点：只保留最新的三篇文章，并按发布时间排序
		const processedSites = rawSites.map(site => {
			if (!site.items || site.items.length === 0) {
				return null;
			}
			
			// 按发布时间排序，只保留最新的3篇
			const sortedItems = [...site.items].sort((a, b) => {
				const dateA = new Date(a.pubDate).getTime() || 0;
				const dateB = new Date(b.pubDate).getTime() || 0;
				return dateB - dateA;
			}).slice(0, 3);
			
			return {
				...site,
				items: sortedItems
			};
		}).filter((site): site is SiteData => site !== null); // 过滤掉没有文章的站点
		
		// 按每个站点最新文章的发布时间对站点进行排序
		processedSites.sort((a, b) => {
			const dateA = new Date(a.items[0]?.pubDate).getTime() || 0;
			const dateB = new Date(b.items[0]?.pubDate).getTime() || 0;
			return dateB - dateA;
		});
		
		// 合并所有文章，用于统计总数
		const mergedItems: FeedItem[] = [];
		processedSites.forEach(site => {
			site.items.forEach(item => {
				mergedItems.push({
					...item,
					site: site.site
				});
			});
		});
		
		// 批量更新，减少多次状态更新导致的重渲染
		sites = processedSites;
		allItems = mergedItems;
	} catch (err) {
		error = err instanceof Error ? err.message : "Unknown error";
		console.error("Failed to fetch friend circle:", err);
	} finally {
		loading = false;
	}
}

function formatDate(dateStr: string): string {
	if (!dateStr) return "";
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString(locale, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		});
	} catch {
		return dateStr;
	}
}

onMount(() => {
		loadVisitedLinks();
		fetchFriendCircle();
		
		// 设置定时自动刷新，每1小时刷新一次
		const intervalId = setInterval(() => {
			fetchFriendCircle();
		}, 1 * 60 * 60 * 1000);
		
		// 组件销毁时清除定时器
		return () => clearInterval(intervalId);
	});
</script>

<div class="friend-circle">
	{#if loading}
		<div class="loading" in:fade>
			<div class="spinner"></div>
			<p>{t("friendCircle.loading")}</p>
		</div>
	{:else if error}
		<div class="error" in:fade>
			<Icon name="lucide--alert-circle" />
			<p>{error}</p>
			<button onclick={fetchFriendCircle} class="retry-btn">
				{t("friendCircle.retry")}
			</button>
		</div>
	{:else}
		<div class="container">
			<div class="stats">
				<span>{t("friendCircle.stats", { total: sites.length })}</span>
				<div class="stats-right">
					<span class="item-count">共 {allItems.length} 篇文章</span>
					<button onclick={fetchFriendCircle} class="refresh-btn" title={t("friendCircle.refresh")}>
						<Icon name="lucide--refresh-cw" />
					</button>
				</div>
			</div>
			{#if sites.length > 0}
				<div class="feed-sites">
					{#each sites as site (site.site.url)} 
						<section class="site-section" in:fly={{ y: 20, duration: 300 }}>
							<div class="site-header">
								<img src={site.site.image} alt={site.site.title} class="site-avatar" loading="lazy" onerror={(e) => { e.currentTarget.src = "/linkback.webp"; }} />
								<div class="site-info">
									<h2 class="site-title">
										<a href={site.site.url} target="_blank" rel="noopener noreferrer">{site.site.title}</a>
									</h2>
									<a href={site.site.url} class="site-url" target="_blank" rel="noopener noreferrer">
										{site.site.url}
									</a>
								</div>
							</div>
							<div class="site-items">
					{#each site.items as item (item.link)} 
						<article class="site-item" class:visited={visitedLinks.has(item.link)}>
							<h3 class="item-title">
								<a href={item.link} target="_blank" rel="noopener noreferrer" onclick={(e) => {
									markAsVisited(item.link);
								}}>{item.title}</a>
							</h3>
							<time class="item-pub-date">
								{formatDate(item.pubDate)}
							</time>
						</article>
					{/each}
					</div>
					</section>
				{/each}
			</div>
			{:else}
				<div class="empty" in:fade>
					<Icon name="lucide--users" />
					<p>{t("friendCircle.empty")}</p>
				</div>
		{/if}
		</div>
	{/if}
</div>

<style>
	.friend-circle {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.container {
		width: 100%;
		max-width: 100%;
	}

	.stats {
		margin-bottom: 1.5rem;
	}

	.loading, .error, .empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		text-align: center;
		color: var(--secondary-color);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--weak-color);
		border-top-color: var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error {
		color: var(--danger-color);
	}

	.retry-btn {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		background: var(--primary-color);
		color: var(--background-color);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.retry-btn:hover {
		opacity: 0.9;
	}

	.stats {
		margin-bottom: 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--block-color);
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--secondary-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.stats-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.item-count {
		font-size: 0.875rem;
	}

	.refresh-btn {
		padding: 0.5rem;
		background: transparent;
		border: 1px solid var(--weak-color);
		border-radius: 6px;
		color: var(--secondary-color);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.refresh-btn:hover {
		background: var(--hover-color);
		border-color: var(--primary-color);
		color: var(--primary-color);
	}

	.refresh-btn:active {
		transform: scale(0.95);
	}

	.feed-sites {
		display: grid;
		grid-template-columns: repeat(2, minmax(200px, 1fr));
		gap: 1.5rem;
	}

	@media (max-width: 768px) {
		.feed-sites {
			grid-template-columns: 1fr;
		}
	}

	.site-section {
		background: var(--block-color);
		border-radius: 12px;
		padding: 1rem;
		overflow: hidden;
		transition: box-shadow 0.2s;
		display: flex;
		flex-direction: column;
	}

	.site-section:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.site-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.site-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
	}

	.site-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.site-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--secondary-color);
	}

	.site-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-color);
	}

	.site-title a {
		color: var(--text-color);
		text-decoration: none;
		transition: color 0.2s;
	}

	.site-title a:hover {
		color: var(--primary-color);
	}

	.site-url {
		font-size: 0.75rem;
		color: var(--secondary-color);
		text-decoration: none;
		transition: color 0.2s;
	}

	.site-url:hover {
		color: var(--primary-color);
	}

	.site-items {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0;
	}

	.site-item {
		padding: 0.5rem;
		background: var(--background-color);
		border-radius: 6px;
		border: 1px solid var(--weak-color);
		transition: all 0.2s;
		position: relative;
	}

	.site-item:hover {
		border-color: var(--primary-color);
		transform: translateY(-2px);
	}

	.site-item::after {
		content: '';
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: #4ade80;
		transition: background-color 0.2s;
	}

	.site-item.visited::after {
		background-color: var(--secondary-color);
	}

	.item-title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 500;
		line-height: 1.3;
		padding-right: 1rem;
		margin-bottom: 0.25rem;
	}

	.item-title a {
		color: var(--text-color);
		text-decoration: none;
		transition: color 0.2s;
	}

	.item-title a:hover {
		color: var(--primary-color);
	}

	.item-pub-date {
		display: block;
		font-size: 0.75rem;
		color: var(--secondary-color);
		margin-top: 0.5rem;
	}

	.site-item {
		padding: 0.5rem;
		background: var(--background-color);
		border-radius: 6px;
		border: 1px solid var(--weak-color);
		transition: all 0.2s;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 60px;
	}

	.item-description {
		margin: 0;
		font-size: 0.875rem;
		color: var(--secondary-color);
		line-height: 1.6;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.site-footer {
		margin-top: auto;
		padding-top: 1rem;
		border-top: 1px solid var(--weak-color);
	}

	.visit-site {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--primary-color);
		color: var(--background-color);
		text-decoration: none;
		border-radius: 6px;
		font-size: 0.875rem;
		transition: opacity 0.2s;
	}

	.visit-site:hover {
		opacity: 0.9;
	}
</style>
