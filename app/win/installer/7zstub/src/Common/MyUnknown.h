// MyUnknown.h

#ifndef __MYUNKNOWN_H
#define __MYUNKNOWN_H

#ifdef _WIN32

#ifdef _WIN32_WCE
#if (_WIN32_WCE > 300)
#include <basetyps.h>
#else
#define MIDL_INTERFACE(x) struct 
#endif
#else
#include <basetyps.h>
#endif

#include <unknwn.h>

#else 
#include "MyWindows.h"
#endif
  
#endif
