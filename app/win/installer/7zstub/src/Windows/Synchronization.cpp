// Windows/Synchronization.cpp

#include "StdAfx.h"

#include "Synchronization.h"

namespace NWindows {
namespace NSynchronization {

CEvent::CEvent(bool manualReset, bool initiallyOwn, LPCTSTR name,
    LPSECURITY_ATTRIBUTES securityAttributes)
{
  if (!Create(manualReset, initiallyOwn, name, securityAttributes))
    throw "CreateEvent error";
}

}}
