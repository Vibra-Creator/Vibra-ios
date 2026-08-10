{pkgs}: {
  deps = [
    pkgs.libdrm
    pkgs.mesa
    pkgs.xorg.libXcomposite
    pkgs.cups
    pkgs.dbus
    pkgs.libxkbcommon
    pkgs.xorg.libxcb
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXfixes
    pkgs.xorg.libXrandr
    pkgs.xorg.libX11
    pkgs.glib
    pkgs.cairo
    pkgs.pango
    pkgs.gtk3
    pkgs.at-spi2-core
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.alsa-lib
    pkgs.expat
    pkgs.nss
    pkgs.nspr
  ];
}
