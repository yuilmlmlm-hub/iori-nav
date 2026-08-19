import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { buildCardHydrationState, resolveEffectiveCardStyle, getCardStyleClass } from '../functions/lib/card-model.js';
import { renderSiteCards } from '../functions/lib/card-renderer.js';
import { renderHorizontalMenu, renderVerticalMenu } from '../functions/lib/menu-renderer.js';
import { parseSettings } from '../functions/lib/settings-parser.js';

test('renderSiteCards escapes user-controlled fields and rejects unsafe URLs', () => {
  const html = renderSiteCards([
    {
      id: 7,
      name: '<script>alert(1)</script>',
      url: 'javascript:alert(1)',
      logo: 'data:text/html,<svg>',
      desc: '"quoted" & <b>bold</b>',
      catelog_name: '<Work>',
    },
  ], parseSettings([]));

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;\/b&gt;/);
  assert.match(html, /&lt;Work&gt;/);
  assert.match(html, /site-category/);
  assert.match(html, /href="#"/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.doesNotMatch(html, /data:text\/html/);
});

test('renderSiteCards reflects layout options used by SSR cards', () => {
  const settings = parseSettings([
    { key: 'layout_hide_desc', value: 'true' },
    { key: 'layout_hide_links', value: 'true' },
    { key: 'layout_hide_category', value: 'true' },
    { key: 'layout_enable_frosted_glass', value: 'true' },
    { key: 'layout_card_style', value: 'style2' },
  ]);

  const html = renderSiteCards([
    { id: 1, name: 'Example', url: 'https://example.com', desc: 'Hidden', catelog_name: 'Hidden' },
  ], settings);

  assert.match(html, /frosted-glass-effect/);
  assert.match(html, /style-2/);
  assert.doesNotMatch(html, /Hidden/);
  assert.doesNotMatch(html, /copy-btn/);
});

test('style three renders compact navigation tiles and hides secondary content', () => {
  const settings = parseSettings([
    { key: 'layout_hide_desc', value: 'false' },
    { key: 'layout_hide_links', value: 'false' },
    { key: 'layout_hide_category', value: 'false' },
    { key: 'layout_enable_frosted_glass', value: 'false' },
    { key: 'layout_card_style', value: 'style3' },
  ]);

  const { config } = buildCardHydrationState([
    { id: 1, name: 'Example', url: 'https://example.com', desc: 'Hidden', catelog_name: 'Tools' },
  ], settings);
  const html = renderSiteCards([
    { id: 1, name: 'Example', url: 'https://example.com', desc: 'Hidden', catelog_name: 'Tools' },
  ], settings);

  assert.equal(config.cardStyle, 'style3');
  assert.equal(config.cardStyleClass, 'style-3');
  assert.equal(config.hideDesc, false);
  assert.equal(config.hideLinks, false);
  assert.equal(config.hideCategory, false);
  assert.match(config.baseCardClass, /bg-white/);
  assert.equal(config.frostedClass, '');
  assert.match(html, /style-3/);
  assert.doesNotMatch(html, /frosted-glass-effect/);
  assert.doesNotMatch(html, /Hidden|Tools|copy-btn/);
});

test('style three with frosted glass uses translucent treatment', () => {
  const settings = parseSettings([
    { key: 'layout_enable_frosted_glass', value: 'true' },
    { key: 'layout_card_style', value: 'style3' },
  ]);

  const { config } = buildCardHydrationState([
    { id: 1, name: 'Example', url: 'https://example.com' },
  ], settings);
  const html = renderSiteCards([
    { id: 1, name: 'Example', url: 'https://example.com' },
  ], settings);

  assert.equal(config.cardStyleClass, 'style-3');
  assert.equal(config.enableFrostedGlass, true);
  assert.equal(config.frostedClass, 'frosted-glass-effect');
  assert.doesNotMatch(config.baseCardClass, /bg-white/);
  assert.match(html, /style-3/);
  assert.match(html, /frosted-glass-effect/);
});

test('style four renders image-backed cards with description inside the media overlay', () => {
  const settings = parseSettings([
    { key: 'layout_card_style', value: 'style4' },
    { key: 'layout_hide_desc', value: 'false' },
    { key: 'layout_hide_links', value: 'false' },
    { key: 'layout_hide_category', value: 'false' },
  ]);

  const { config, cards } = buildCardHydrationState([
    {
      id: 1,
      name: 'Example',
      url: 'https://example.com',
      desc: 'Beautiful card',
      catelog_name: 'Tools',
      card_image: 'https://img.example.com/card.jpg',
      card_video: '',
    },
  ], settings);
  const html = renderSiteCards([
    {
      id: 1,
      name: 'Example',
      url: 'https://example.com',
      desc: 'Beautiful card',
      catelog_name: 'Tools',
      card_image: 'https://img.example.com/card.jpg',
    },
  ], settings);

  assert.equal(config.cardStyle, 'style4');
  assert.equal(config.cardStyleClass, 'style-4');
  assert.equal(config.isMediaCardStyle, true);
  assert.equal(config.hideDesc, false);
  assert.equal(cards[0].cardImageHtml, 'https://img.example.com/card.jpg');
  assert.equal(cards[0].hasCardImage, true);
  assert.equal(cards[0].hasCardVideo, false);
  assert.match(html, /style-4/);
  assert.match(html, /site-card-media/);
  assert.match(html, /<img src="https:\/\/img\.example\.com\/card\.jpg"/);
  assert.match(html, /site-card-media-overlay/);
  assert.match(html, /Beautiful card/);
});

test('style five renders video-backed cards and falls back safely without media', () => {
  const settings = parseSettings([
    { key: 'layout_card_style', value: 'style5' },
  ]);

  const htmlWithVideo = renderSiteCards([
    {
      id: 1,
      name: 'Example',
      url: 'https://example.com',
      desc: 'Moving card',
      catelog_name: 'Tools',
      card_video: 'https://v.example.com/card.mp4',
      card_image: 'https://img.example.com/poster.jpg',
    },
  ], settings);
  const htmlFallback = renderSiteCards([
    {
      id: 1,
      name: 'Example',
      url: 'https://example.com',
      desc: 'Moving card',
    },
  ], settings);
  const { config } = buildCardHydrationState([], settings);

  assert.equal(config.cardStyleClass, 'style-5');
  assert.equal(config.isMediaCardStyle, true);
  assert.match(htmlWithVideo, /style-5/);
  assert.match(htmlWithVideo, /<video src="https:\/\/v\.example\.com\/card\.mp4"/);
  assert.match(htmlWithVideo, /poster="https:\/\/img\.example\.com\/poster\.jpg"/);
  assert.match(htmlWithVideo, /autoplay muted loop playsinline/);
  assert.match(htmlFallback, /site-card-media-fallback/);
  assert.doesNotMatch(htmlFallback, /<video/);
});

test('media card URLs are sanitized before hydration', () => {
  const { cards } = buildCardHydrationState([
    {
      id: 1,
      name: 'Example',
      url: 'https://example.com',
      card_image: 'javascript:alert(1)',
      card_video: 'data:text/html,x',
    },
  ], parseSettings([]));

  assert.equal(cards[0].cardImageHtml, '');
  assert.equal(cards[0].cardVideoHtml, '');
  assert.equal(cards[0].hasCardImage, false);
  assert.equal(cards[0].hasCardVideo, false);
});

test('media card CSS covers style four and five on home and admin preview', () => {
  const homeCss = readFileSync('public/css/style.css', 'utf8');
  const previewCss = readFileSync('public/css/admin-preview-cards.css', 'utf8');

  assert.match(homeCss, /\.site-card\.style-4\s*[,{]/);
  assert.match(homeCss, /\.site-card\.style-5\s*\{/);
  assert.match(homeCss, /\.site-card\.style-4 \.site-card-media,/);
  assert.match(homeCss, /\.site-card\.style-5 \.site-card-media\s*\{/);
  assert.match(homeCss, /site-card-media-overlay/);
  assert.match(homeCss, /site-card-media-fallback/);
  assert.match(homeCss, /#sitesGrid\.desktop-card-style4/);
  assert.match(homeCss, /#sitesGrid\.desktop-card-style5/);
  assert.match(homeCss, /#sitesGrid\.mobile-card-style4/);
  assert.match(homeCss, /#sitesGrid\.mobile-card-style5/);
  assert.match(previewCss, /\.site-card\.style-4\s*[,{]/);
  assert.match(previewCss, /\.site-card\.style-5\s*\{/);
  assert.match(previewCss, /site-card-media-overlay/);
});


test('mobile style three has its own compact card config', () => {
  const settings = parseSettings([
    { key: 'mobile_layout_card_style', value: 'style3' },
    { key: 'mobile_layout_hide_desc', value: 'false' },
    { key: 'mobile_layout_hide_links', value: 'false' },
    { key: 'mobile_layout_hide_category', value: 'false' },
  ]);

  const { configs } = buildCardHydrationState([
    { id: 1, name: 'Example', url: 'https://example.com' },
  ], settings);

  assert.equal(configs.mobile.cardStyleClass, 'style-3');
  assert.equal(configs.mobile.hideDesc, false);
  assert.equal(configs.mobile.hideLinks, false);
  assert.equal(configs.mobile.hideCategory, false);
});

test('per-bookmark card style overrides the global style on SSR', () => {
  const settings = parseSettings([
    { key: 'layout_card_style', value: 'style1' },
    { key: 'layout_hide_desc', value: 'false' },
  ]);

  const compactHtml = renderSiteCards([
    { id: 1, name: 'Compact', url: 'https://example.com', desc: 'Hidden desc', catelog_name: 'Tools', card_style: 'style3' },
  ], settings);
  const plainHtml = renderSiteCards([
    { id: 2, name: 'Plain', url: 'https://example.org', desc: 'Visible desc', catelog_name: 'Tools' },
  ], settings);

  assert.match(compactHtml, /class="[^"]*style-3[^"]*"[^>]*data-id="1"/);
  assert.doesNotMatch(compactHtml, /Hidden desc/);
  assert.doesNotMatch(compactHtml, /copy-btn/);
  assert.match(plainHtml, /data-id="2"/);
  assert.match(plainHtml, /Visible desc/);
  assert.match(plainHtml, /copy-btn/);
  assert.doesNotMatch(plainHtml, /class="[^"]*style-3[^"]*"/);
});

test('a style-one bookmark keeps secondary content under a global style three', () => {
  const settings = parseSettings([
    { key: 'layout_card_style', value: 'style3' },
    { key: 'layout_hide_desc', value: 'false' },
  ]);

  const html = renderSiteCards([
    { id: 1, name: 'Custom', url: 'https://example.com', desc: 'Keep me', catelog_name: 'Tools', card_style: 'style1' },
  ], settings);

  assert.match(html, /data-id="1"[\s\S]*?site-card-content/);
  assert.match(html, /Keep me/);
  assert.match(html, /copy-btn/);
  assert.doesNotMatch(html, /class="[^"]*style-3[^"]*"[^>]*data-id="1"/);
});

test('per-bookmark media styles render regardless of the global style', () => {
  const settings = parseSettings([
    { key: 'layout_card_style', value: 'style1' },
  ]);

  const html = renderSiteCards([
    {
      id: 1,
      name: 'Image Card',
      url: 'https://example.com',
      desc: 'Desc',
      catelog_name: 'Tools',
      card_style: 'style4',
      card_image: 'https://img.example.com/card.jpg',
    },
    {
      id: 2,
      name: 'Video Card',
      url: 'https://example.org',
      desc: 'Desc',
      catelog_name: 'Tools',
      card_style: 'style5',
      card_video: 'https://v.example.com/card.mp4',
    },
  ], settings);

  assert.match(html, /class="[^"]*style-4[^"]*"[^>]*data-id="1"/);
  assert.match(html, /site-card-media"><img src="https:\/\/img\.example\.com\/card\.jpg"/);
  assert.match(html, /class="[^"]*style-5[^"]*"[^>]*data-id="2"/);
  assert.match(html, /<video src="https:\/\/v\.example\.com\/card\.mp4"/);
});

test('hydration exposes the per-bookmark style and resolves effective style', () => {
  const settings = parseSettings([
    { key: 'layout_card_style', value: 'style2' },
  ]);
  const { config, cards } = buildCardHydrationState([
    { id: 1, name: 'A', url: 'https://a.example', card_style: 'style4' },
    { id: 2, name: 'B', url: 'https://b.example', card_style: 'not-a-style' },
    { id: 3, name: 'C', url: 'https://c.example' },
  ], settings);

  assert.equal(cards[0].cardStyle, 'style4');
  assert.equal(cards[1].cardStyle, '');
  assert.equal(cards[2].cardStyle, '');
  assert.equal(resolveEffectiveCardStyle(config, cards[0]), 'style4');
  assert.equal(resolveEffectiveCardStyle(config, cards[1]), 'style2');
  assert.equal(resolveEffectiveCardStyle(config, cards[2]), 'style2');
  assert.equal(getCardStyleClass('style4'), 'style-4');
  assert.equal(getCardStyleClass('style1'), '');
});

test('card hydration state shares sanitization and render config', () => {
  const settings = parseSettings([
    { key: 'layout_enable_frosted_glass', value: 'true' },
    { key: 'layout_card_style', value: 'style2' },
    { key: 'layout_grid_cols', value: '5' },
  ]);

  const { config, cards } = buildCardHydrationState([
    {
      id: 7,
      name: '<script>alert(1)</script>',
      url: 'https://example.com',
      logo: 'data:text/html,<svg>',
      desc: '"quoted" & <b>bold</b>',
      catelog_id: 3,
      catelog_name: '<Work>',
    },
  ], settings);

  assert.equal(config.enableFrostedGlass, true);
  assert.equal(config.cardStyleClass, 'style-2');
  assert.equal(config.hideCopyText, true);
  assert.equal(cards[0].nameHtml, '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(cards[0].catalogHtml, '&lt;Work&gt;');
  assert.equal(cards[0].descHtml, '&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;');
  assert.equal(cards[0].urlHtml, 'https://example.com/');
  assert.equal(cards[0].logoUrlHtml, '');
  assert.equal(cards[0].hasValidUrl, true);
  assert.match(cards[0].searchText, /example\.com/);
});

test('card hydration state exposes mobile card config separately', () => {
  const settings = parseSettings([
    { key: 'layout_grid_cols', value: '6' },
    { key: 'layout_hide_desc', value: 'false' },
    { key: 'mobile_layout_grid_cols', value: '3' },
    { key: 'mobile_layout_hide_desc', value: 'true' },
    { key: 'mobile_layout_card_style', value: 'style2' },
  ]);

  const { config, configs } = buildCardHydrationState([
    { id: 1, name: 'Example', url: 'https://example.com' },
  ], settings);

  assert.equal(config.gridCols, '6');
  assert.equal(config.hideDesc, false);
  assert.equal(configs.desktop.gridCols, '6');
  assert.equal(configs.mobile.gridCols, '3');
  assert.equal(configs.mobile.hideDesc, true);
  assert.equal(configs.mobile.cardStyleClass, 'style-2');
  assert.equal(configs.mobile.hideCopyText, true);
});

test('card hydration state respects mobile style one', () => {
  const settings = parseSettings([
    { key: 'mobile_layout_card_style', value: 'style1' },
  ]);

  const { configs } = buildCardHydrationState([
    { id: 1, name: 'Example', url: 'https://example.com' },
  ], settings);

  assert.equal(configs.mobile.cardStyle, 'style1');
  assert.equal(configs.mobile.cardStyleClass, '');
});

test('narrow mobile CSS does not force style one cards into style two layout', () => {
  const css = readFileSync('public/css/style.css', 'utf8');
  const marker = '@media (max-width: 400px)';
  const start = css.indexOf(marker);
  const blockStart = start >= 0 ? css.indexOf('{', start) : -1;
  let depth = 0;
  let end = css.length;
  for (let index = blockStart; index >= 0 && index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0 && index > blockStart) {
      end = index + 1;
      break;
    }
  }
  const narrowMobileBlock = blockStart >= 0 ? css.slice(start, end) : '';

  assert.match(narrowMobileBlock, /\.site-card\.style-2 \.flex\.items-start/);
  assert.doesNotMatch(narrowMobileBlock, /\.site-card \.flex\.items-start/);
  assert.doesNotMatch(narrowMobileBlock, /\.site-card \.site-icon/);
});

test('narrow mobile compact density styles target configured card and column combinations', () => {
  const css = readFileSync('public/css/style.css', 'utf8');
  const marker = '@media (max-width: 389px)';
  const start = css.lastIndexOf(marker);
  const blockStart = start >= 0 ? css.indexOf('{', start) : -1;
  let depth = 0;
  let end = css.length;
  for (let index = blockStart; index >= 0 && index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0 && index > blockStart) {
      end = index + 1;
      break;
    }
  }
  const compactThreeColumnBlock = blockStart >= 0 ? css.slice(start, end) : '';

  assert.match(compactThreeColumnBlock, /#sitesGrid\.grid-cols-2\.mobile-card-style1/);
  assert.match(compactThreeColumnBlock, /#sitesGrid\.grid-cols-3\.mobile-card-style1/);
  assert.match(compactThreeColumnBlock, /#sitesGrid\.grid-cols-3\.mobile-card-style2/);
  assert.doesNotMatch(compactThreeColumnBlock, /#sitesGrid\.grid-cols-2\.mobile-card-style2/);
  assert.match(compactThreeColumnBlock, /gap: 0\.5rem/);
  assert.match(compactThreeColumnBlock, /\.site-card-content/);
  assert.match(compactThreeColumnBlock, /\.site-icon/);
  assert.match(compactThreeColumnBlock, /\.site-title/);
  assert.match(compactThreeColumnBlock, /\.site-category/);
});

test('style three CSS keeps the compact glass navigation treatment', () => {
  const css = readFileSync('public/css/style.css', 'utf8');

  assert.match(css, /\.site-card\.style-3 \{/);
  assert.match(css, /height: 85px !important/);
  assert.match(css, /\.site-card\.style-3:not\(\.frosted-glass-effect\)/);
  assert.match(css, /\.site-card\.style-3\.frosted-glass-effect/);
  assert.match(css, /background-color: rgba\(255, 255, 255, 0\.15\) !important/);
  assert.match(css, /#sitesGrid\.desktop-card-style3/);
  assert.match(css, /#sitesGrid\.mobile-card-style3/);
  assert.match(css, /max-width: 55rem/);
  assert.match(css, /html\.dark body\.custom-wallpaper \.site-card\.style-3\.frosted-glass-effect/);
  assert.match(css, /body\.desktop-page-style3 \.home-search-shell/);
  assert.match(css, /body\.desktop-page-style3 footer/);
  assert.match(css, /body\.mobile-page-style3\s*\{[^}]*--search-engine-text-color/);
  assert.match(css, /body\.mobile-page-style3 \.home-search-shell/);
  assert.match(css, /body\.mobile-page-style3 footer/);
});

test('footer colors follow desktop card style and stay white on mobile', () => {
  const homeCss = readFileSync('public/css/style.css', 'utf8');
  const previewCss = readFileSync('public/css/admin-preview-cards.css', 'utf8');

  assert.match(homeCss, /#app-scroll > \.main-content > footer \{[\s\S]*?color:\s*#111827;/);
  assert.match(homeCss, /@media \(min-width:\s*768px\)[\s\S]*?body\.desktop-page-style3 footer,[\s\S]*?color:\s*#ffffff\s*!important;/);
  assert.match(homeCss, /@media \(max-width:\s*767px\)[\s\S]*?#app-scroll > \.main-content > footer,[\s\S]*?color:\s*#ffffff\s*!important;/);
  assert.doesNotMatch(homeCss, /html\.dark body:not\(\.custom-wallpaper\) #app-scroll > \.main-content > footer/);
  assert.match(previewCss, /\.home-live-preview\[data-device="mobile"\] \.live-preview-footer,[\s\S]*?color:\s*#ffffff\s*!important;/);
});

test('style three search focus suppresses the transient Tailwind ring', () => {
  const css = readFileSync('public/css/style.css', 'utf8');

  assert.match(css, /body\.desktop-page-style3 \.search-input-target,[\s\S]*?--tw-ring-offset-shadow:\s*0 0 #0000\s*!important;[\s\S]*?--tw-ring-shadow:\s*0 0 #0000\s*!important/);
  assert.match(css, /body\.desktop-page-style3 \.search-input-target:focus,[\s\S]*?border-color:\s*transparent\s*!important;[\s\S]*?--tw-ring-shadow:\s*0 0 #0000\s*!important/);
  assert.match(css, /body\.mobile-page-style3 \.search-input-target:focus,[\s\S]*?border-color:\s*transparent\s*!important;[\s\S]*?--tw-ring-shadow:\s*0 0 #0000\s*!important/);
});

test('category nav keeps overflow visible so dropdowns are not clipped', () => {
  const homeCss = readFileSync('public/css/style.css', 'utf8');
  const indexSource = readFileSync('functions/index.js', 'utf8');
  const navSource = readFileSync('public/js/home-category-nav.js', 'utf8');

  assert.match(homeCss, /#horizontalCategoryNav[\s\S]*?overflow:\s*visible\s*!important/);
  assert.match(indexSource, /horizontalCategoryNavOverflowClass = 'overflow-visible'/);
  // 打开「更多」时跳过 checkOverflow，避免 reset 拆掉弹出层
  assert.match(navSource, /dropdown\.classList\.contains\('hidden'\)/);
});

test('horizontal category overflow matches preview width-based collapse', () => {
  const source = readFileSync('public/js/home-category-nav.js', 'utf8');
  const homeCss = readFileSync('public/css/style.css', 'utf8');
  const indexSource = readFileSync('functions/index.js', 'utf8');

  // 与后台预览一致：按可用宽度折叠，单行 nowrap
  assert.match(source, /measureItemsWidth/);
  assert.match(source, /MAX_VISIBLE_BUTTONS\s*=\s*8/);
  assert.match(source, /MAX_VISIBLE_ROOT_WITH_MORE\s*=\s*MAX_VISIBLE_BUTTONS\s*-\s*1/);
  // ≤7 个时仍要按宽度折叠，与预览一致
  assert.match(source, /needsCollapse\(availableWidth\)/);
  assert.match(source, /measureItemsWidth\(\) > availableWidth/);
  const previewNav = readFileSync('public/js/admin-settings-preview-nav.js', 'utf8');
  assert.match(previewNav, /MAX_VISIBLE_BUTTONS\s*=\s*8/);
  assert.match(previewNav, /MAX_VISIBLE_ROOT_WITH_MORE/);
  assert.match(source, /availableWidth/);
  assert.match(source, /restoreCategoryFromDropdown/);
  assert.match(source, /document\.fonts/);
  assert.match(source, /ResizeObserver/);
  assert.match(homeCss, /\.horizontal-category-nav-shell\s*\{[^}]*width:\s*min\(100%, 64rem\)/);
  assert.match(homeCss, /\.nav-btn\s*\{[^}]*min-width:\s*calc\(4em \+ 2rem\)/);
  assert.match(homeCss, /body\.desktop-page-style3[\s\S]*?\.nav-btn[\s\S]*?min-width:\s*calc\(4em \+ 2rem\)/);
  assert.match(indexSource, /is-single-line/);
  assert.match(indexSource, /flex-nowrap/);
  assert.doesNotMatch(indexSource, /max-height: 60px/);
});

test('style three top navigation keeps the single-line overflow menu available', () => {
  const css = readFileSync('public/css/style.css', 'utf8');

  assert.doesNotMatch(css, /body\.desktop-page-style3\.category-pos-top #horizontalMoreWrapper\s*\{[^}]*display:\s*none\s*!important/);
  assert.doesNotMatch(css, /body\.mobile-page-style3\.category-pos-top #horizontalMoreWrapper\s*\{[^}]*display:\s*none\s*!important/);
  assert.doesNotMatch(css, /body\.desktop-page-style3\.category-pos-top #horizontalCategoryNav\s*\{[^}]*max-height:\s*none\s*!important/);
  assert.doesNotMatch(css, /body\.mobile-page-style3\.category-pos-top #horizontalCategoryNav\s*\{[^}]*max-height:\s*none\s*!important/);
});

test('style one and two top navigation aligns with the action row without changing button styles', () => {
  const homeCss = readFileSync('public/css/style.css', 'utf8');
  const previewCss = readFileSync('public/css/admin-preview-controls.css', 'utf8');

  assert.match(homeCss, /body\.category-pos-top:not\(\.desktop-page-style3\) header\s*\{[^}]*padding-top:\s*1rem\s*!important/);
  assert.match(homeCss, /body\.category-pos-top:not\(\.desktop-page-style3\) \.category-nav-top-wrap\s*\{[^}]*min-height:\s*2\.5rem;[^}]*margin-bottom:\s*1\.6rem/);
  assert.match(homeCss, /body\.category-pos-top:not\(\.mobile-page-style3\) header\s*\{[^}]*padding-top:\s*1rem\s*!important/);
  assert.match(previewCss, /\.home-live-preview\.category-top:not\(\.uses-card-style-3\) \.live-preview-hero\s*\{[^}]*padding-top:\s*1rem/);

  const desktopAlignmentBlock = homeCss.match(/body\.category-pos-top:not\(\.desktop-page-style3\) \.category-nav-top-wrap\s*\{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(desktopAlignmentBlock, /\.nav-btn|background|border-radius|color/);
});

test('external search inherits bookmark title colors but keeps selected state blue', () => {
  const homeCss = readFileSync('public/css/style.css', 'utf8');
  const previewCss = readFileSync('public/css/admin-preview-controls.css', 'utf8');

  assert.match(homeCss, /body:not\(\.desktop-page-style3\)\s*\{[^}]*--search-engine-text-color:\s*var\(--desktop-card-title-color, #111827\)/);
  assert.match(homeCss, /body\.desktop-page-style3\s*\{[^}]*--search-engine-text-color:\s*var\(--desktop-card-title-color, rgba\(255, 255, 255, 0\.92\)\)/);
  assert.match(homeCss, /body:not\(\.mobile-page-style3\)\s*\{[^}]*--search-engine-text-color:\s*var\(--mobile-card-title-color, #111827\)/);
  assert.match(homeCss, /\.search-engine-option\s*\{[^}]*color:\s*var\(--search-engine-text-color, #111827\)\s*!important/);
  assert.match(homeCss, /\.search-engine-option\s*\{[^}]*border-radius:\s*0\s*!important;[^}]*background:\s*transparent\s*!important/);
  assert.match(homeCss, /\.search-engine-option::after\s*\{[^}]*background:\s*#399dff/);
  // 默认态跟标题色，选中态固定强调蓝
  assert.match(homeCss, /body \.search-engine-option\.active\s*\{[^}]*color:\s*#399dff\s*!important;[^}]*background:\s*transparent\s*!important/);
  assert.match(previewCss, /\.home-live-preview:not\(\.uses-card-style-3\) \.search-engine-option\s*\{[^}]*color:\s*#111827\s*!important/);
  assert.match(previewCss, /\.home-live-preview\.uses-card-style-3 \.search-engine-option\s*\{[^}]*color:\s*rgba\(255, 255, 255, 0\.92\)\s*!important/);
  assert.match(previewCss, /\.home-live-preview \.search-engine-option,[\s\S]*?border-radius:\s*0\s*!important;[\s\S]*?background:\s*transparent\s*!important/);
  assert.match(previewCss, /\.home-live-preview \.search-engine-option\.active,[\s\S]*?color:\s*#399dff\s*!important;[\s\S]*?background:\s*transparent\s*!important/);
});

test('bookmark title settings explain and drive external search colors only', () => {
  const html = readFileSync('public/admin/index.html', 'utf8');
  const previewSource = readFileSync('public/js/admin-settings-preview-render.js', 'utf8');

  assert.match(html, /书签标题样式[\s\S]*?颜色同时用于外部搜索文字/);
  assert.match(html, /手机书签标题样式[\s\S]*?颜色同时用于手机外部搜索文字/);
  assert.match(previewSource, /option\.style\.setProperty\('color', settings\.cardTitleColor, 'important'\)/);
  assert.match(previewSource, /searchEngines\.querySelectorAll\('\.search-engine-option'\)/);
  // 选中项不写标题色，交给 CSS 强调蓝
  assert.match(previewSource, /classList\.contains\('active'\)[\s\S]*?removeProperty\('color'\)/);
  assert.doesNotMatch(previewSource, /searchEngines\.style\.(?:fontFamily|fontSize)/);
});

test('home and admin preview use a sticky footer layout', () => {
  const homeCss = readFileSync('public/css/style.css', 'utf8');
  const previewShellCss = readFileSync('public/css/admin-preview-shell.css', 'utf8');
  const previewCardCss = readFileSync('public/css/admin-preview-cards.css', 'utf8');

  assert.match(homeCss, /#app-scroll > \.main-content \{[\s\S]*?display: flex;[\s\S]*?min-height: 100%;/);
  assert.match(homeCss, /#app-scroll > \.main-content > section \{[\s\S]*?width: 100%;[\s\S]*?flex-shrink: 0;/);
  assert.match(homeCss, /#app-scroll > \.main-content > footer \{[\s\S]*?margin-top: auto;/);
  assert.match(previewShellCss, /\.live-preview-page \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
  assert.match(previewCardCss, /\.live-preview-footer \{[\s\S]*?margin-top: auto;/);
});

test('home search keeps the original engine behavior', () => {
  const source = readFileSync('public/js/home-search.js', 'utf8');

  assert.match(source, /currentSearchEngine === 'bing'/);
  assert.match(source, /currentSearchEngine = 'github'/);
  assert.doesNotMatch(source, /www\.bing\.com\/search/);
});

test('custom wallpaper input resists browser and password-manager autofill', () => {
  const html = readFileSync('public/admin/index.html', 'utf8');
  const source = readFileSync('public/js/admin-settings-core.js', 'utf8');
  const input = html.match(/<input[^>]*id="customWallpaperInput"[^>]*>/)?.[0] || '';

  assert.match(input, /type="url"/);
  assert.match(input, /autocomplete="new-password"/);
  assert.match(input, /inputmode="url"/);
  assert.match(input, /\sreadonly(?:\s|>)/);
  assert.match(input, /data-lpignore="true"/);
  assert.match(input, /data-1p-ignore="true"/);
  assert.match(input, /data-bwignore="true"/);
  assert.match(input, /data-form-type="other"/);
  assert.match(source, /initAutofillGuards/);
  assert.match(source, /wallpaperInput\.addEventListener\('focus', unlockWallpaperInput\)/);
  assert.match(source, /wallpaperInput\.removeAttribute\('readonly'\)/);
});

test('admin mobile preview hides copy text at the same card density as the real page', () => {
  const source = readFileSync('public/js/admin-settings-preview.js', 'utf8');
  const sandbox = {
    window: {
      AdminSettings: {},
      matchMedia() {
        return { matches: false };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const shouldHideCopyText = sandbox.window.AdminSettings.preview.shouldHideCopyTextForPreview;

  assert.equal(shouldHideCopyText('mobile', '2'), false);
  assert.equal(shouldHideCopyText('mobile', '3'), true);
  assert.equal(shouldHideCopyText('desktop', '4'), false);
  assert.equal(shouldHideCopyText('desktop', '5'), true);
});

test('menu renderers escape names and use category IDs in URLs', () => {
  const categories = [
    {
      id: 1,
      catelog: 'A & B',
      children: [
        { id: 2, catelog: '<Child>', children: [] },
      ],
    },
  ];

  const horizontal = renderHorizontalMenu(categories, '<Child>');
  const vertical = renderVerticalMenu(categories, 'A & B', false);

  assert.match(horizontal, /A &amp; B/);
  assert.match(horizontal, /href="\?catalog=2"/);
  assert.match(horizontal, /&lt;Child&gt;/);
  assert.match(horizontal, /data-id="2"/);
  assert.doesNotMatch(horizontal, /%3CChild%3E/);
  assert.match(vertical, /A &amp; B/);
  assert.match(vertical, /href="\?catalog=1"/);
  assert.match(vertical, /nav|bg-secondary-100|text-primary-700/);
});
