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
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
