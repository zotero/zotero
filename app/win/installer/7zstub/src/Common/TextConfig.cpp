// Common/TextConfig.cpp

#include "StdAfx.h"

#include "Common/TextConfig.h"

#include "Defs.h"
#include "Common/UTFConvert.h"

static bool IsDelimitChar(char c)
{
  return (c == ' ' || c == 0x0A || c == 0x0D ||
      c == '\0' || c == '\t');
}
    
static AString GetIDString(const char *string, int &finishPos)
{
  AString result;
  for (finishPos = 0; true; finishPos++)
  {
    char c = string[finishPos];
    if (IsDelimitChar(c) || c == '=')
      return result;
    result += c;
  }
}

static bool WaitNextLine(const AString &string, int &pos)
{
  for (;pos < string.Length(); pos++)
    if (string[pos] == 0x0A)
      return true;
  return false;
}

static bool SkipSpaces(const AString &string, int &pos)
{
  for (;pos < string.Length(); pos++)
  {
    char c = string[pos];
    if (!IsDelimitChar(c))
    {
      if (c != ';')
        return true;
      if (!WaitNextLine(string, pos))
        return false;
    }
  }
  return false;
}

bool GetTextConfig(const AString &string, CObjectVector<CTextConfigPair> &pairs)
{
  pairs.Clear();
  int pos = 0;

  /////////////////////
  // read strings

  while (true)
  {
    if (!SkipSpaces(string, pos))
      break;
    CTextConfigPair pair;
    int finishPos;
    AString temp = GetIDString(((const char *)string) + pos, finishPos);
    if (!ConvertUTF8ToUnicode(temp, pair.ID))
      return false;
    if (finishPos == 0)
      return false;
    pos += finishPos;
    if (!SkipSpaces(string, pos))
      return false;
    if (string[pos] != '=')
      return false;
    pos++;
    if (!SkipSpaces(string, pos))
      return false;
    if (string[pos] != '\"')
      return false;
    pos++;
    AString message;
    while(true)
    {
      if (pos >= string.Length())
        return false;
      char c = string[pos++];
      if (c == '\"')
        break;
      if (c == '\\')
      {
        char c = string[pos++];
        switch(c)
        {
          case 'n':
            message += '\n';
            break;
          case 't':
            message += '\t';
            break;
          case '\\':
            message += '\\';
            break;
          case '\"':
            message += '\"';
            break;
          default:
            message += '\\';
            message += c;
            break;
        }
      }
      else
        message += c;
    }
    if (!ConvertUTF8ToUnicode(message, pair.String))
      return false;
    pairs.Add(pair);
  }
  return true;
}

int FindTextConfigItem(const CObjectVector<CTextConfigPair> &pairs, const UString &id)
{
  for (int  i = 0; i < pairs.Size(); i++)
    if (pairs[i].ID.Compare(id) == 0)
      return i;
  return -1;
}

UString GetTextConfigValue(const CObjectVector<CTextConfigPair> &pairs, const UString &id)
{
  int index = FindTextConfigItem(pairs, id);
  if (index < 0)
    return UString();
  return pairs[index].String;
}
