export enum RegistryStartupKey {
  CurrentUserRun = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  LocalMachineRun = 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  LocalMachineWowRun = 'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
}
