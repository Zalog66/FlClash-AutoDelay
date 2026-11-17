/**
 * FLClash 覆写脚本 — 自动测速（兼容版）
 *
 * 同时支持两种配置结构：
 *   A. 配置使用 proxy-providers（机场订阅常见）→ 启用 provider health-check
 *   B. 节点直接写在 proxies 里 → 添加 url-test 自动测速组 + 修改现有组
 *
 * 功能：
 *   1. 切换配置后自动测速（配置加载时立即执行一次健康检查）
 *   2. 按设定间隔定时自动测速
 *
 * 使用：FLClash → 扩展 → 脚本模式 → 粘贴本脚本 → 保存 → 切换一次配置
 */

// ===== 可调参数 =====
const TEST_INTERVAL_SECONDS = 300;  // 测速间隔：60=1分, 300=5分, 600=10分, 1800=30分
const TEST_URL = 'http://www.gstatic.com/generate_204';
const TEST_TIMEOUT_MS = 5000;
// ====================

function main(config) {
  let modified = false;

  // ===== 方式A：处理 proxy-providers =====
  if (config['proxy-providers'] && typeof config['proxy-providers'] === 'object') {
    const providerNames = Object.keys(config['proxy-providers']);
    if (providerNames.length > 0) {
      for (const name of providerNames) {
        const provider = config['proxy-providers'][name];
        if (typeof provider !== 'object' || provider === null) continue;

        provider['health-check'] = {
          enable: true,
          url: TEST_URL,
          interval: TEST_INTERVAL_SECONDS,
          timeout: TEST_TIMEOUT_MS,
          lazy: false  // false=配置加载立即测一次（关键！）
        };
      }
      modified = true;
    }
  }

  // ===== 方式B：处理直接写在 proxies 里的节点 =====
  if (config['proxies'] && Array.isArray(config['proxies']) && config['proxies'].length > 0) {
    // 收集所有节点名
    const proxyNames = config['proxies']
      .filter(p => p && typeof p === 'object' && p.name)
      .map(p => p.name);

    if (proxyNames.length > 0) {
      // 确保 proxy-groups 存在
      if (!config['proxy-groups'] || !Array.isArray(config['proxy-groups'])) {
        config['proxy-groups'] = [];
      }

      // 检查是否已存在自动测速组
      const autoTestGroupName = '⚡自动测速';
      const existingGroup = config['proxy-groups'].find(g => g && g.name === autoTestGroupName);

      if (!existingGroup) {
        // 添加 url-test 组，包含所有节点
        // url-test 组会自动测试所有成员延迟并选最快的，同时也会刷新所有节点延迟显示
        config['proxy-groups'].unshift({
          name: autoTestGroupName,
          type: 'url-test',
          proxies: proxyNames,
          url: TEST_URL,
          interval: TEST_INTERVAL_SECONDS,
          tolerance: 50
        });
      }

      // 同时给现有的 url-test/fallback 组确保测试参数
      for (const group of config['proxy-groups']) {
        if (!group || typeof group !== 'object') continue;
        if (group.type === 'url-test' || group.type === 'fallback' || group.type === 'load-balance') {
          if (!group.url) group.url = TEST_URL;
          if (!group.interval) group.interval = TEST_INTERVAL_SECONDS;
          if (!group.timeout) group.timeout = TEST_TIMEOUT_MS;
        }
      }

      modified = true;
    }
  }

  // ===== 确保规则里有指向自动测速组的规则（如果添加了的话） =====
  // （可选，不添加也不影响测速，只是不会实际使用这个组）

  return config;
}
