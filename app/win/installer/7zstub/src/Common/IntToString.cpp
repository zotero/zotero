// Common/IntToString.cpp

#include "StdAfx.h"

#include "IntToString.h"

void ConvertUInt64ToString(UInt64 value, char *s, UInt32 base)
{
  if (base < 2 || base > 36)
  {
    *s = L'\0';
    return;
  }
  char temp[72];
  int pos = 0;
  do 
  {
    int delta = (int)(value % base);
    temp[pos++] = (delta < 10) ? ('0' + delta) : ('a' + (delta - 10));
    value /= base;
  }
  while (value != 0);
  do
    *s++ = temp[--pos];
  while(pos > 0);
  *s = '\0';
}

void ConvertUInt64ToString(UInt64 value, wchar_t *s)
{
  wchar_t temp[32];
  int pos = 0;
  do 
  {
    temp[pos++] = L'0' + (int)(value % 10);
    value /= 10;
  }
  while (value != 0);
  do 
    *s++ = temp[--pos];
  while(pos > 0);
  *s = L'\0';
}

void ConvertInt64ToString(Int64 value, char *s)
{
  if (value < 0)
  {
    *s++ = '-';
    value = -value;
  }
  ConvertUInt64ToString(value, s);
}

void ConvertInt64ToString(Int64 value, wchar_t *s)
{
  if (value < 0)
  {
    *s++ = L'-';
    value = -value;
  }
  ConvertUInt64ToString(value, s);
}
