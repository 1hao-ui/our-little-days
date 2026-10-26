plugins {
    id("com.android.application")
}

val appUrl = (project.findProperty("APP_URL") as String?)
    ?: System.getenv("APP_URL")
    ?: ""

android {
    namespace = "com.onehao.littledays"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.onehao.littledays"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField(
            "String",
            "APP_URL",
            "\"${appUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"",
        )
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
