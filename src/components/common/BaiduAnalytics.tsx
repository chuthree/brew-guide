// 百度统计组件

export function BaiduAnalytics() {
  return (
    <>
      <script
        src="https://hm.baidu.com/hm.js?1d5ab7c4016b8737328359797bfaac08"
        async
      ></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            var _hmt = _hmt || [];
            // 添加单页应用支持
            _hmt.push(['_requirePlugin', 'UrlChangeTracker', {
              shouldTrackUrlChange: function (newPath, oldPath) {
                return newPath && oldPath;
              }
            }]);
          `,
        }}
      ></script>
    </>
  );
} 