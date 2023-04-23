// Common/StdOutStream.h

#ifndef __COMMON_STDOUTSTREAM_H
#define __COMMON_STDOUTSTREAM_H

#include <stdio.h>

#include "Types.h"

class CStdOutStream 
{
  bool _streamIsOpen;
  FILE *_stream;
public:
  CStdOutStream (): _streamIsOpen(false) {};
  CStdOutStream (FILE *stream): _streamIsOpen(false), _stream(stream) {};
  ~CStdOutStream ();
  bool Open(const char *fileName);
  bool Close();
  bool Flush();
 
  CStdOutStream & operator<<(CStdOutStream & (* aFunction)(CStdOutStream  &));
  CStdOutStream & operator<<(const char *string);
  CStdOutStream & operator<<(const wchar_t *string);
  CStdOutStream & operator<<(char c);
  CStdOutStream & operator<<(int number);
  CStdOutStream & operator<<(UInt64 number);
};

CStdOutStream & endl(CStdOutStream & outStream);

extern CStdOutStream g_StdOut;
extern CStdOutStream g_StdErr;

#endif
