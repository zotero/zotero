#!/bin/bash

rm -f jslint_results.txt
touch jshint_done.txt

JSLINT="java -client -jar ./rhino/js-1.7R2.jar ./jshint/rhino.js"
OPTS="onevar=false,undef=true,boss=false,curly=true,forin=true,regexp=false,laxbreak=true,maxerr=1000"

if [ "$1" == "" ]; then
    echo "#### jslint results for citeproc-dev/src/*.js ####" > jslint_results.txt
    files=$(ls ./src/*.js)
else
    #java -client -jar ./rhino/js-1.7R2.jar jslint.js $1
	${JSLINT} $1 ${OPTS}
	exit 0
fi

for i in ${files}; do
    BASE=$(basename $i .js)
    if [ "xmldom" == "$BASE" ]; then
        continue
    fi
    if [ "xmle4x" == "$BASE" ]; then
        continue
    fi
    
    STARTSWITH=$(echo $BASE | sed -e "s/^\(.......\).*/\1/")
    if [ "$STARTSWITH" == "testing" ]; then
       continue
    fi
	if [ "$(grep -c ${i} jshint_done.txt)" != "0" ]; then
		continue
    fi
    echo "Processing ... $i"
    #echo "" >> jslint_results.txt

    #echo "<<< ${i} >>>" >> jslint_results.txt
    echo "<<< ${i} >>>" > jslint_results.txt
    ${JSLINT} $i  ${OPTS} >> jslint_results.txt
    
    if [ "$?" == "0" ]; then
	  if [ "$(grep -c '${i}' jshint_done.txt)" == "0" ]; then
		  echo ${i} >> jshint_done.txt
	  fi
      continue
    else
      echo "== Results =="
      cat jslint_results.txt
      break
    fi
done
