// Windows/COM.h

#ifndef __WINDOWS_COM_H
#define __WINDOWS_COM_H

#include "Common/String.h"

namespace NWindows {
namespace NCOM {

class CComInitializer
{
public:
  CComInitializer() { CoInitialize(NULL);};
  ~CComInitializer() { CoUninitialize(); };
};

class CStgMedium
{
  STGMEDIUM _object;
public:
  bool _mustBeReleased;
  CStgMedium(): _mustBeReleased(false) {}
  ~CStgMedium() { Free(); }
  void Free() 
  { 
    if(_mustBeReleased) 
      ReleaseStgMedium(&_object); 
    _mustBeReleased = false;
  }
  const STGMEDIUM* operator->() const { return &_object;}
  STGMEDIUM* operator->() { return &_object;}
  STGMEDIUM* operator&() { return &_object; }
};

//////////////////////////////////
// GUID <--> String Conversions
UString GUIDToStringW(REFGUID guid);
AString GUIDToStringA(REFGUID guid);
#ifdef UNICODE
  #define GUIDToString GUIDToStringW
#else
  #define GUIDToString GUIDToStringA
#endif // !UNICODE

HRESULT StringToGUIDW(const wchar_t *string, GUID &classID);
HRESULT StringToGUIDA(const char *string, GUID &classID);
#ifdef UNICODE
  #define StringToGUID StringToGUIDW
#else
  #define StringToGUID StringToGUIDA
#endif // !UNICODE

  
}}

#endif
