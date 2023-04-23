// Common/StdInStream.h

#ifndef __COMMON_STDINSTREAM_H
#define __COMMON_STDINSTREAM_H

#include <stdio.h>

#include "Common/String.h"
#include "Types.h"

class CStdInStream 
{
  bool _streamIsOpen;
  FILE *_stream;
public:
  CStdInStream(): _streamIsOpen(false) {};
  CStdInStream(FILE *stream): _streamIsOpen(false), _stream(stream) {};
  ~CStdInStream();
  bool Open(LPCTSTR fileName);
  bool Close();

  AString ScanStringUntilNewLine();
  void ReadToString(AString &resultString);

  bool Eof();
  int GetChar();
};

extern CStdInStream g_StdIn;

#endif
