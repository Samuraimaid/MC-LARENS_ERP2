$csharpSource = @"
using System;
using System.IO;
using System.Threading.Tasks;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;

public class WinOcrHelper
{
    public static async Task<string> RecognizeTextAsync(string imagePath)
    {
        var file = await StorageFile.GetFileFromPathAsync(imagePath);
        using (var stream = await file.OpenAsync(FileAccessMode.Read))
        {
            var decoder = await BitmapDecoder.CreateAsync(stream);
            var bitmap = await decoder.GetSoftwareBitmapAsync();
            var engine = OcrEngine.TryCreateFromLanguage(new Language("en-US")) ?? OcrEngine.TryCreateFromUserProfileLanguages();
            if (engine == null) return "";
            var result = await engine.RecognizeAsync(bitmap);
            return result.Text;
        }
    }
}
"@

Add-Type -TypeDefinition $csharpSource -Language CSharp -ReferencedAssemblies "System.Runtime.WindowsRuntime", "Windows.Foundation.UniversalApiContract"

$samplePath = "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota\sample_title_TOYOTA (1).png"
$text = [WinOcrHelper]::RecognizeTextAsync($samplePath).GetAwaiter().GetResult()
Write-Host "Texto Reconocido por OCR Nativo:"
Write-Host "-> '$text'"
