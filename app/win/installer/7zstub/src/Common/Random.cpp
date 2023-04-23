// Common/Random.cpp

#include "StdAfx.h"

#include <time.h>
#include <stdlib.h>

#include "Common/Random.h"

void CRandom::Init(unsigned int seed)
  { srand(seed); }

void CRandom::Init()
  { Init((unsigned int)time(NULL)); }

int CRandom::Generate() const
  { return rand(); }
