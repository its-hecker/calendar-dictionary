plugins {
    id("com.android.application")
}

android {
    namespace = "com.sabber.taqwim"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sabber.taqwim"
        minSdk = 29
        targetSdk = 35
        versionCode = 2
        versionName = "2.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
