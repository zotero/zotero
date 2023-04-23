7-Zip 4.42 Sources
------------------

7-Zip is a file archiver for Windows 95/98/ME/NT/2000/2003/XP. 

7-Zip Copyright (C) 1999-2006 Igor Pavlov.


License Info
------------

Most of 7-Zip source code is under GNU LGPL.

Files in folders
  7zip/Compress/Rar20
  7zip/Compress/Rar29
  7zip/Compress/Rar29/Original
are licensed under "unRAR license + GNU LGPL" license.
Source code files in all other folders of this package are under GNU LGPL.

"unRAR license + GNU LGPL" means that you must follow 
GNU LGPL in all aspects while it is in agreement 
with unRAR license. But you can not break unRAR license rules.
It means that unRAR license is main license in that pair.

You can find unRAR license in file unrarLicense.txt
You can find GNU LGPL license in file copying.txt


GNU LGPL information:
---------------------

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA


unRAR license + GNU LGPL Notes
------------------------------

Please check main restriction from unRar license:

   2. The unRAR sources may be used in any software to handle RAR
      archives without limitations free of charge, but cannot be used
      to re-create the RAR compression algorithm, which is proprietary.
      Distribution of modified unRAR sources in separate form or as a
      part of other software is permitted, provided that it is clearly
      stated in the documentation and source comments that the code may
      not be used to develop a RAR (WinRAR) compatible archiver.

In brief it means:
1) You can compile and use compiled files under GNU LGPL rules, since 
   unRAR license almost has no restrictions for compiled files.
   You can link these compiled files to LGPL programs.
2) You can fix bugs in source code and use compiled fixed version.
3) You can not use unRAR sources to re-create the RAR compression algorithm.


7zip\Compress\Rar29\Original folder contains files that are modified
versions of original unRAR source code files.


License notes
-------------

You can support development of 7-Zip by registering.

7-Zip is free software distributed under the GNU LGPL.
If you need license with other conditions, write to
http://www.7-zip.org/support.html

---
Also this package contains files from LZMA SDK
you can download LZMA SDK from this page:
http://www.7-zip.org/sdk.html
read about addtional licenses for LZMA SDK in file
DOC/lzma.txt


How to compile
--------------
To compile sources you need Visual C++ 6.0.
For compiling some files you also need 
new Platform SDK from Microsoft' Site:
http://www.microsoft.com/msdownload/platformsdk/sdkupdate/psdk-full.htm
or
http://www.microsoft.com/msdownload/platformsdk/sdkupdate/XPSP2FULLInstall.htm
or
http://www.microsoft.com/msdownload/platformsdk/sdkupdate/

If you use MSVC6, specify SDK directories at top of directories lists:
Tools / Options / Directories
  - Include files
  - Library files


To compile 7-Zip for AMD64 and IA64 you need:
  Windows Server 2003 SP1 Platform SDK from microsoft.com



Compiling under Unix/Linux
--------------------------
Check this site for Posix/Linux version:
http://sourceforge.net/projects/p7zip/


Notes:
------
7-Zip consists of COM modules (DLL files).
But 7-Zip doesn't use standard COM interfaces for creating objects.
Look at
7zip\UI\Client7z folder for example of using DLL files of 7-Zip. 
Some DLL files can use other DLL files from 7-Zip.
If you don't like it, you must use standalone version of DLL.
To compile standalone version of DLL you must include all used parts
to project and define some defs. 
For example, 7zip\Bundles\Format7z is a standalone version  of 7z.dll 
that works with 7z format. So you can use such DLL in your project 
without additional DLL files.


Description of 7-Zip sources package
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

DOC                Documentation
---
  7zFormat.txt   - 7z format description
  copying.txt    - GNU LGPL license
  unRarLicense.txt - License for unRAR part of source code
  history.txt    - Sources history
  Methods.txt    - Compression method IDs
  readme.txt     - Readme file
  lzma.txt       - LZMA SDK description
  7zip.nsi       - installer script for NSIS


Common            Common modules
Windows           Win32 wrappers

7zip
-------
  Common          Common modules for 7-zip

  Archive         7-Zip Archive Format Plugins 
  --------
    Common
    7z
    Arj
    BZip2
    Cab
    Cpio
    GZip
    Rar
    Rpm            
    Split
    Tar
    Zip

  Bundle          Modules that are bundles of other modules
  ------
    Alone         7za.exe: Standalone version of 7z
    Alone7z       7zr.exe: Standalone version of 7z that supports only 7z/LZMA/BCJ/BCJ2
    SFXCon        7zCon.sfx: Console 7z SFX module
    SFXWin        7z.sfx: Windows 7z SFX module
    SFXSetup      7zS.sfx: Windows 7z SFX module for Installers
    Format7z      7za.dll: Standalone version of 7z.dll

  UI
  --
    Agent         Intermediary modules for FAR plugin and Explorer plugin
    Console       7z.exe Console version
    Explorer      Explorer plugin
    Resource      Resources
    Far           FAR plugin  
    Client7z      Test application for 7za.dll 

  Compress
  --------
    BZip2        BZip2 compressor
      Original   Download BZip2 compression sources from
                    http://sources.redhat.com/bzip2/index.html   
                 to that folder.
    Branch       Branch converter
    ByteSwap     Byte Swap converter
    Copy         Copy coder
    Deflate       
    Implode
    Arj
    LZMA
    PPMd          Dmitry Shkarin's PPMdH with small changes.
    LZ            Lempel - Ziv
      MT          Multi Thread Match finder
      BinTree     Match Finder based on Binary Tree
      Patricia    Match Finder based on Patricia algoritm
      HashChain   Match Finder based on Hash Chains

  Crypto          Crypto modules
  ------
    7zAES         Cipher for 7z
    AES           AES Cipher
    Rar20         Cipher for Rar 2.0
    RarAES        Cipher for Rar 3.0
    Zip           Cipher for Zip

  FileManager       File Manager


---
Igor Pavlov
http://www.7-zip.org


---
End of document

