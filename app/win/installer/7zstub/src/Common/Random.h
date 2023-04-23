// Common/Random.h

#ifndef __COMMON_RANDOM_H
#define __COMMON_RANDOM_H

class CRandom
{
public:
  void Init();
  void Init(unsigned int seed);
  int Generate() const;
};

#endif


