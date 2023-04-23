// Windows/DLL.h

#ifndef __WINDOWS_DLL_H
#define __WINDOWS_DLL_H

#include "../Common/String.h"

namespace NWindows {
namespace NDLL {

class CLibrary
{
  bool LoadOperations(HMODULE newModule);
protected:
  HMODULE _module;
public:
  operator HMODULE() const { return _module; }
  HMODULE* operator&() { return &_module; }

  CLibrary():_module(NULL) {};
  ~CLibrary();
  void Attach(HMODULE m)
  {
    Free();
    _module = m;
  }
  HMODULE Detach()
  {
    HMODULE m = _module;
    _module = NULL;
    return m;
  }

  // operator HMODULE() const { return _module; };
  // bool IsLoaded() const { return (_module != NULL); };
  bool Free();
  bool LoadEx(LPCTSTR fileName, DWORD flags = LOAD_LIBRARY_AS_DATAFILE);
  bool Load(LPCTSTR fileName);
  #ifndef _UNICODE
  bool LoadEx(LPCWSTR fileName, DWORD flags = LOAD_LIBRARY_AS_DATAFILE);
  bool Load(LPCWSTR fileName);
  #endif
  FARPROC GetProcAddress(LPCSTR procName) const
    { return ::GetProcAddress(_module, procName); }
};

bool MyGetModuleFileName(HMODULE hModule, CSysString &result);
#ifndef _UNICODE
bool MyGetModuleFileName(HMODULE hModule, UString &result);
#endif

}}

#endif
