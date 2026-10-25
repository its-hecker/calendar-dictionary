package com.sabber.taqwim;

import com.sabber.offline.OfflineActivity;

public class MainActivity extends OfflineActivity {
    @Override
    protected void onResume() {
        super.onResume();
        // Refresh today's dates after returning from another app or after midnight.
        evaluatePage("if (typeof render === 'function') render();");
    }
}
