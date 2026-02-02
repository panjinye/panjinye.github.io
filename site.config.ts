import siteConfig from "./src/utils/config";

const config = siteConfig({
	title: "Ficor's Path of Law",
	prologue: "一个重新站起来，准备出发的人\nDo one Thing at a Time, and Do Well.",
	author: {
		name: "Ficor",
		email: "ficor@qq.com",
		link: "https://lawpan.cc"
	},
	social: [
		{
			name: "Mastodon",
			url: "https://mastodon.social/@ficor",
			icon: "simple-icons--mastodon"
		},
		{
			name: "邮箱",
			url: "mailto:ficor@qq.com",
			icon: "lucide--mail"
		},
		{
			name: "GitHub",
			url: "https://github.com/panjinye",
			icon: "simple-icons--github"
		},
		{
			name: "Twitter",
			url: "https://twitter.com/JinyePan",
			icon: "simple-icons--twitter"
		},
		{
			name: "316160777",
			url: "https://qq.com",
			icon: "simple-icons--qq"
		},
		{
			name: "微信",
			url: "https://weixin.qq.com",
			icon: "simple-icons--wechat"
		},
		{
			name: "RSS",
			url: "/feed.xml",
			icon: "lucide--rss"
		}
	],
	rocketMenu: [
		{
			name: "开往",
			url: "https://www.travellings.cn/plain.html"
		},
		{
			name: "虫洞",
			url: "https://www.foreverblog.cn/go.html"
		},
		{
			name: "笔墨迹",
			url: "https://blogscn.fun/random.html"
		},
		{
			name: "空间穿梭",
			url: "https://www.blogsclub.org/go"
		}
	],
	description: "在路上的思绪与脚印",
	copyright: {
		type: "CC BY-NC-ND 4.0",
		year: "2008"
	},
	i18n: {
		locales: ["en", "zh-cn"],
		defaultLocale: "zh-cn"
	},
	pagination: {
		note: 15,
		jotting: 24,
		instruction: 15
	},
	heatmap: {
		unit: "day",
		weeks: 20
	},
	feed: {
		section: "*",
		limit: 20
	},
	latest: "*"
});

export const monolocale = Number(config.i18n.locales.length) === 1;

export default config;
