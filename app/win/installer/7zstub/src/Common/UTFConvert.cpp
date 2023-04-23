// UTFConvert.cpp

#include "StdAfx.h"

#include "UTFConvert.h"
#include "Types.h"

static Byte kUtf8Limits[5] = { 0xC0, 0xE0, 0xF0, 0xF8, 0xFC };

// These functions are for UTF8 <-> UTF16 conversion.

bool ConvertUTF8ToUnicode(const AString &src, UString &dest)
{
  dest.Empty();
  for(int i = 0; i < src.Length();)
  {
    Byte c = (Byte)src[i++];
    if (c < 0x80)
    {
      dest += (wchar_t)c;
      continue;
    }
    if(c < 0xC0)
      return false;
    int numAdds;
    for (numAdds = 1; numAdds < 5; numAdds++)
      if (c < kUtf8Limits[numAdds])
        break;
    UInt32 value = (c - kUtf8Limits[numAdds - 1]);
    do
    {
      if (i >= src.Length())
        return false;
      Byte c2 = (Byte)src[i++];
      if (c2 < 0x80 || c2 >= 0xC0)
        return false;
      value <<= 6;
      value |= (c2 - 0x80);
      numAdds--;
    }
    while(numAdds > 0);
    if (value < 0x10000)
      dest += (wchar_t)(value);
    else
    {
      value -= 0x10000;
      if (value >= 0x100000)
        return false;
      dest += (wchar_t)(0xD800 + (value >> 10));
      dest += (wchar_t)(0xDC00 + (value & 0x3FF));
    }
  }
  return true; 
}

bool ConvertUnicodeToUTF8(const UString &src, AString &dest)
{
  dest.Empty();
  for(int i = 0; i < src.Length();)
  {
    UInt32 value = (UInt32)src[i++];
    if (value < 0x80)
    {
      dest += (char)value;
      continue;
    }
    if (value >= 0xD800 && value < 0xE000)
    {
      if (value >= 0xDC00)
        return false;
      if (i >= src.Length())
        return false;
      UInt32 c2 = (UInt32)src[i++];
      if (c2 < 0xDC00 || c2 >= 0xE000)
        return false;
      value = ((value - 0xD800) << 10) | (c2 - 0xDC00);
    }
    int numAdds;
    for (numAdds = 1; numAdds < 5; numAdds++)
      if (value < (((UInt32)1) << (numAdds * 5 + 6)))
        break;
    dest += (char)(kUtf8Limits[numAdds - 1] + (value >> (6 * numAdds)));
    do
    {
      numAdds--;
      dest += (char)(0x80 + ((value >> (6 * numAdds)) & 0x3F));
    }
    while(numAdds > 0);
  }
  return true;
}
