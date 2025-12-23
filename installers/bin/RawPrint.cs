using System;
using System.IO;
using System.Runtime.InteropServices;

class RawPrint
{
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFOA pDocInfo);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Uso: RawPrint.exe <nombre_impresora> <archivo>");
            return 1;
        }

        string printerName = args[0];
        string filePath = args[1];

        if (!File.Exists(filePath))
        {
            Console.Error.WriteLine("Archivo no encontrado: " + filePath);
            return 2;
        }

        byte[] data = File.ReadAllBytes(filePath);

        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Thermal Ticket";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
        {
            Console.Error.WriteLine("No se pudo abrir la impresora: " + printerName);
            return 3;
        }

        try
        {
            if (!StartDocPrinter(hPrinter, 1, ref di))
            {
                Console.Error.WriteLine("Error en StartDocPrinter");
                return 4;
            }

            if (!StartPagePrinter(hPrinter))
            {
                Console.Error.WriteLine("Error en StartPagePrinter");
                return 5;
            }

            int written = 0;
            bool success = WritePrinter(hPrinter, data, data.Length, out written);

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);

            if (!success || written != data.Length)
            {
                Console.Error.WriteLine("Error escribiendo: " + written + "/" + data.Length + " bytes");
                return 6;
            }

            Console.WriteLine("OK: " + written + " bytes enviados a " + printerName);
            return 0;
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }
}
