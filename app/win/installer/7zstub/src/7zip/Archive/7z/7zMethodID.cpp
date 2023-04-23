// 7zMethodID.cpp

#include "StdAfx.h"

#include "7zMethodID.h"

namespace NArchive {
namespace N7z {

static wchar_t GetHex(Byte value)
{
  return (value < 10) ? ('0' + value) : ('A' + (value - 10));
}

static bool HexCharToInt(wchar_t value, Byte &result)
{
  if (value >= '0' && value <= '9')
    result = value - '0';
  else if (value >= 'a' && value <= 'f')
    result = 10 + value - 'a';
  else if (value >= 'A' && value <= 'F')
    result = 10 + value - 'A';
  else
    return false;
  return true;
}

static bool TwoHexCharsToInt(wchar_t valueHigh, wchar_t valueLow, Byte &result)
{
  Byte resultHigh, resultLow;
  if (!HexCharToInt(valueHigh, resultHigh))
    return false;
  if (!HexCharToInt(valueLow, resultLow))
    return false;
  result = (resultHigh << 4) + resultLow;
  return true;
}

UString CMethodID::ConvertToString() const
{
  UString result;
  for (int i = 0; i < IDSize; i++)
  {
    Byte b = ID[i];
    result += GetHex(b >> 4);
    result += GetHex(b & 0xF);
  }
  return result;
}

bool CMethodID::ConvertFromString(const UString &srcString)
{
  int length = srcString.Length();
  if ((length & 1) != 0 || (length >> 1) > kMethodIDSize)
    return false;
  IDSize = length / 2;
  UInt32 i;
  for(i = 0; i < IDSize; i++)
    if (!TwoHexCharsToInt(srcString[i * 2], srcString[i * 2 + 1], ID[i]))
      return false;
  for(; i < kMethodIDSize; i++)
    ID[i] = 0;
  return true;
}

bool operator==(const CMethodID &a1, const CMethodID &a2)
{
  if (a1.IDSize != a2.IDSize)
    return false;
  for (UInt32 i = 0; i < a1.IDSize; i++)
    if (a1.ID[i] != a2.ID[i])
      return false;
  return true;
}

}}
