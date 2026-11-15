# ML Kit creates manifest-discovered registrars through their public no-argument constructors.
-keep class * implements com.google.firebase.components.ComponentRegistrar {
    public <init>();
}
