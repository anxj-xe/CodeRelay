using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

class Launcher
{
    static int Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(dir, "dist", "native-host.js");

        string nodeExe = "node";
        string programFiles = Environment.GetEnvironmentVariable("ProgramFiles");
        string nodePath = Path.Combine(programFiles ?? @"C:\Program Files", "nodejs", "node.exe");
        if (File.Exists(nodePath))
        {
            nodeExe = nodePath;
        }

        ProcessStartInfo psi = new ProcessStartInfo
        {
            FileName = nodeExe,
            Arguments = "\"" + script + "\"",
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = false,
            CreateNoWindow = true
        };

        using (Process process = Process.Start(psi))
        {
            Task inputTask = Task.Run(() =>
            {
                try
                {
                    using (Stream stdin = Console.OpenStandardInput())
                    {
                        byte[] buffer = new byte[4096];
                        int bytesRead;
                        while ((bytesRead = stdin.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            process.StandardInput.BaseStream.Write(buffer, 0, bytesRead);
                            process.StandardInput.BaseStream.Flush();
                        }
                    }
                    process.StandardInput.Close();
                }
                catch { }
            });

            try
            {
                using (Stream stdout = Console.OpenStandardOutput())
                {
                    byte[] buffer = new byte[4096];
                    int bytesRead;
                    while ((bytesRead = process.StandardOutput.BaseStream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        stdout.Write(buffer, 0, bytesRead);
                        stdout.Flush();
                    }
                }
            }
            catch { }

            process.WaitForExit();
            return process.ExitCode;
        }
    }
}
