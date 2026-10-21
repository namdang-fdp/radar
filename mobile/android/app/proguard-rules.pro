# shared_preferences_android 2.5.x calls coroutine signatures through JNI.
# R8 must preserve the referenced types as well as the registrar method names.
-keep class kotlin.coroutines.** { *; }
-keep interface kotlin.coroutines.** { *; }
-keep class kotlin.Result { *; }
-keep class kotlin.Result$* { *; }
-keep class kotlin.Unit { *; }
-keep class kotlin.jvm.internal.DefaultConstructorMarker { *; }
-keep interface kotlin.enums.EnumEntries { *; }
