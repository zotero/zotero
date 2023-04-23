// Common/StdOutStream.cpp

#include "StdAfx.h"

#include <tchar.h>

#include "StdOutStream.h"
#include "Common/IntToString.h"
#include "Common/StringConvert.h"

static const char kNewLineChar =  '\n';

static const char *kFileOpenMode = "wt";

CStdOutStream  g_StdOut(stdout);
CStdOutStream  g_StdErr(stderr);

bool CStdOutStream::Open(const char *fileName)
{
  Close();
  _stream = fopen(fileName, kFileOpenMode);
  _streamIsOpen = (_stream != 0);
  return _streamIsOpen;
}

bool CStdOutStream::Close()
{
  if(!_streamIsOpen)
    return true;
  _streamIsOpen = (fclose(_stream) != 0);
  return !_streamIsOpen;
}

bool CStdOutStream::Flush()
{
  if(!_streamIsOpen)
    return false;
  return (fflush(_stream) == 0);
}

CStdOutStream::~CStdOutStream ()
{
  Close();
}

CStdOutStream & CStdOutStream::operator<<(CStdOutStream & (*aFunction)(CStdOutStream  &))
{
  (*aFunction)(*this);    
  return *this;
}

CStdOutStream & endl(CStdOutStream & outStream)
{
  return outStream << kNewLineChar;
}

CStdOutStream & CStdOutStream::operator<<(const char *string)
{
  fputs(string, _stream);
  return *this;
}

CStdOutStream & CStdOutStream::operator<<(const wchar_t *string)
{
  *this << (const char *)UnicodeStringToMultiByte(string, CP_OEMCP);
  return *this;
}

CStdOutStream & CStdOutStream::operator<<(char c)
{
  fputc(c, _stream);
  return *this;
}

CStdOutStream & CStdOutStream::operator<<(int number)
{
  char textString[32];
  ConvertInt64ToString(number, textString);
  return operator<<(textString);
}

CStdOutStream & CStdOutStream::operator<<(UInt64 number)
{
  char textString[32];
  ConvertUInt64ToString(number, textString);
  return operator<<(textString);
}
