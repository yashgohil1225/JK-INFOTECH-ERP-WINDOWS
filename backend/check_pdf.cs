using System;
using Windows.Data.Pdf;
using Windows.Storage;

class Program {
    static void Main(string[] args) {
        try {
            string path = args.Length > 0 ? args[0] : @"Y:\JK Infotech ERP\backend\test_gstr1.pdf";
            var fileTask = StorageFile.GetFileFromPathAsync(path);
            var file = fileTask.AsTask().Result;
            var docTask = PdfDocument.LoadFromFileAsync(file);
            var doc = docTask.AsTask().Result;
            var page = doc.GetPage(0);
            Console.WriteLine("WINRT PDF SIZE -> Width: " + page.Size.Width + " Height: " + page.Size.Height + " Rotation: " + page.Rotation);
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex);
        }
    }
}
