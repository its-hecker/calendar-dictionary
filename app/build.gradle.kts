plugins {
    id("com.android.application")
}

android {
    namespace = "com.sabber.urdudictionary"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sabber.urdudictionary"
        minSdk = 29
        targetSdk = 35
        versionCode = 4
        versionName = "2.2"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
