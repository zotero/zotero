// CommandLineParser.cpp

#include "StdAfx.h"

#include "CommandLineParser.h"

namespace NCommandLineParser {

void SplitCommandLine(const UString &src, UString &dest1, UString &dest2)
{
  dest1.Empty();
  dest2.Empty();
  bool quoteMode = false;
  int i;
  for (i = 0; i < src.Length(); i++)
  {
    wchar_t c = src[i];
    if (c == L'\"')
      quoteMode = !quoteMode;
    else if (c == L' ' && !quoteMode)
    {
      i++;
      break;
    }
    else 
      dest1 += c;
  }
  dest2 = src.Mid(i);
}

void SplitCommandLine(const UString &s, UStringVector &parts)
{
  UString sTemp = s;
  sTemp.Trim();
  parts.Clear();
  while (true)
  {
    UString s1, s2;
    SplitCommandLine(sTemp, s1, s2);
    // s1.Trim();
    // s2.Trim();
    if (!s1.IsEmpty())
      parts.Add(s1);
    if (s2.IsEmpty())
      return;
    sTemp = s2;
  }
}


static const wchar_t kSwitchID1 = '-';
// static const wchar_t kSwitchID2 = '/';

static const wchar_t kSwitchMinus = '-';
static const wchar_t *kStopSwitchParsing = L"--";

static bool IsItSwitchChar(wchar_t c)
{ 
  return (c == kSwitchID1 /*|| c == kSwitchID2 */); 
}

CParser::CParser(int numSwitches):
  _numSwitches(numSwitches)
{
  _switches = new CSwitchResult[_numSwitches];
}

CParser::~CParser()
{
  delete []_switches;
}

void CParser::ParseStrings(const CSwitchForm *switchForms, 
  const UStringVector &commandStrings)
{
  int numCommandStrings = commandStrings.Size();
  bool stopSwitch = false;
  for (int i = 0; i < numCommandStrings; i++)
  {
    const UString &s = commandStrings[i];
    if (stopSwitch)
      NonSwitchStrings.Add(s);
    else
      if (s == kStopSwitchParsing)
        stopSwitch = true;
      else
        if (!ParseString(s, switchForms))
          NonSwitchStrings.Add(s);
  }
}

// if string contains switch then function updates switch structures
// out: (string is a switch)
bool CParser::ParseString(const UString &s, const CSwitchForm *switchForms)
{
  int len = s.Length();
  if (len == 0) 
    return false;
  int pos = 0;
  if (!IsItSwitchChar(s[pos]))
    return false;
  while(pos < len)
  {
    if (IsItSwitchChar(s[pos]))
      pos++;
    const int kNoLen = -1;
    int matchedSwitchIndex = 0; // GCC Warning
    int maxLen = kNoLen;
    for(int switchIndex = 0; switchIndex < _numSwitches; switchIndex++)
    {
      int switchLen = MyStringLen(switchForms[switchIndex].IDString);
      if (switchLen <= maxLen || pos + switchLen > len) 
        continue;

      UString temp = s + pos;
      temp = temp.Left(switchLen);
      if(temp.CompareNoCase(switchForms[switchIndex].IDString) == 0)
      // if(_strnicmp(switchForms[switchIndex].IDString, LPCSTR(s) + pos, switchLen) == 0)
      {
        matchedSwitchIndex = switchIndex;
        maxLen = switchLen;
      }
    }
    if (maxLen == kNoLen)
      throw "maxLen == kNoLen";
    CSwitchResult &matchedSwitch = _switches[matchedSwitchIndex];
    const CSwitchForm &switchForm = switchForms[matchedSwitchIndex];
    if ((!switchForm.Multi) && matchedSwitch.ThereIs)
      throw "switch must be single";
    matchedSwitch.ThereIs = true;
    pos += maxLen;
    int tailSize = len - pos;
    NSwitchType::EEnum type = switchForm.Type;
    switch(type)
    {
      case NSwitchType::kPostMinus:
        {
          if (tailSize == 0)
            matchedSwitch.WithMinus = false;
          else
          {
            matchedSwitch.WithMinus = (s[pos] == kSwitchMinus);
            if (matchedSwitch.WithMinus)
              pos++;
          }
          break;
        }
      case NSwitchType::kPostChar:
        {
          if (tailSize < switchForm.MinLen)
            throw "switch is not full";
          UString set = switchForm.PostCharSet;
          const int kEmptyCharValue = -1;
          if (tailSize == 0)
            matchedSwitch.PostCharIndex = kEmptyCharValue;
          else
          {
            int index = set.Find(s[pos]);
            if (index < 0)
              matchedSwitch.PostCharIndex =  kEmptyCharValue;
            else
            {
              matchedSwitch.PostCharIndex = index;
              pos++;
            }
          }
          break;
        }
      case NSwitchType::kLimitedPostString: 
      case NSwitchType::kUnLimitedPostString: 
        {
          int minLen = switchForm.MinLen;
          if (tailSize < minLen)
            throw "switch is not full";
          if (type == NSwitchType::kUnLimitedPostString)
          {
            matchedSwitch.PostStrings.Add(s.Mid(pos));
            return true;
          }
          int maxLen = switchForm.MaxLen;
          UString stringSwitch = s.Mid(pos, minLen);
          pos += minLen;
          for(int i = minLen; i < maxLen && pos < len; i++, pos++)
          {
            wchar_t c = s[pos];
            if (IsItSwitchChar(c))
              break;
            stringSwitch += c;
          }
          matchedSwitch.PostStrings.Add(stringSwitch);
          break;
        }
      case NSwitchType::kSimple:
          break;
    }
  }
  return true;
}

const CSwitchResult& CParser::operator[](size_t index) const
{
  return _switches[index];
}

/////////////////////////////////
// Command parsing procedures

int ParseCommand(int numCommandForms, const CCommandForm *commandForms, 
    const UString &commandString, UString &postString)
{
  for(int i = 0; i < numCommandForms; i++)
  {
    const UString id = commandForms[i].IDString;
    if (commandForms[i].PostStringMode)
    {
      if(commandString.Find(id) == 0)
      {
        postString = commandString.Mid(id.Length());
        return i;
      }
    }
    else
      if (commandString == id)
      {
        postString.Empty();
        return i;
      }
  }
  return -1;
}
   
}
