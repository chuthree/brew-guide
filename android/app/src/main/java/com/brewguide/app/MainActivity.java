package com.brewguide.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        // 不调用 super.onBackPressed()，完全阻止默认的返回键行为
        // 所有返回逻辑都由我们的 JavaScript 侧滑代码处理
    }
}
