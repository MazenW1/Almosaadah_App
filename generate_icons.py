from PIL import Image
import os

# مقاسات أيقونات Android
sizes = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

# مسار الصورة الأصلية
icon_path = "assets/icon.png"

# المسار الأساسي لمجلدات Android
android_base = "android/app/src/main/res"

img = Image.open(icon_path).convert("RGBA")

for folder, size in sizes.items():
    out_dir = os.path.join(android_base, folder)
    os.makedirs(out_dir, exist_ok=True)
    
    resized = img.resize((size, size), Image.LANCZOS)
    
    # ic_launcher.png
    resized.save(os.path.join(out_dir, "ic_launcher.png"))
    # ic_launcher_round.png
    resized.save(os.path.join(out_dir, "ic_launcher_round.png"))
    # ic_launcher_foreground.png
    resized.save(os.path.join(out_dir, "ic_launcher_foreground.png"))
    
    print(f"✅ {folder}: {size}x{size}")

print("\n🎉 تم توليد كل الأيقونات بنجاح!")