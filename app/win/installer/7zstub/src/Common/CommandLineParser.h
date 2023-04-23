// Common/CommandLineParser.h

#ifndef __COMMON_COMMANDLINEPARSER_H
#define __COMMON_COMMANDLINEPARSER_H

#include "Common/String.h"

namespace NCommandLineParser {

void SplitCommandLine(const UString &src, UString &dest1, UString &dest2);
void SplitCommandLine(const UString &s, UStringVector &parts);

namespace NSwitchType {
  enum EEnum
  { 
    kSimple,
    kPostMinus,
    kLimitedPostString,
    kUnLimitedPostString,
    kPostChar
  };
}

struct CSwitchForm
{
  const wchar_t *IDString;
  NSwitchType::EEnum Type;
  bool Multi;
  int MinLen;
  int MaxLen;
  const wchar_t *PostCharSet;
};

struct CSwitchResult
{
  bool ThereIs;
  bool WithMinus;
  UStringVector PostStrings;
  int PostCharIndex;
  CSwitchResult(): ThereIs(false) {};
};
  
class CParser
{
  int _numSwitches;
  CSwitchResult *_switches;
  bool ParseString(const UString &s, const CSwitchForm *switchForms); 
public:
  UStringVector NonSwitchStrings;
  CParser(int numSwitches);
  ~CParser();
  void ParseStrings(const CSwitchForm *switchForms, 
    const UStringVector &commandStrings);
  const CSwitchResult& operator[](size_t index) const;
};

/////////////////////////////////
// Command parsing procedures

struct CCommandForm
{
  wchar_t *IDString;
  bool PostStringMode;
};

// Returns: Index of form and postString; -1, if there is no match
int ParseCommand(int numCommandForms, const CCommandForm *commandForms, 
    const UString &commandString, UString &postString);

}

#endif
