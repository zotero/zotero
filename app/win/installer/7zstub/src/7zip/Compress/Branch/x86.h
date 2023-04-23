// x86.h

#ifndef __X86_H
#define __X86_H

#include "BranchCoder.h"
#include "BranchX86.h"

struct CBranch86
{
  UInt32 _prevMask;
  UInt32 _prevPos;
  void x86Init() { x86_Convert_Init(_prevMask, _prevPos); }
};

MyClassB(BCJ_x86, 0x01, 3, CBranch86 , 
    virtual void SubInit() { x86Init(); })

#endif
