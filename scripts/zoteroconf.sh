#!/bin/sh
if [ ! "$1" ]; then
	echo "Action not specified"
	exit 1
fi

if [ $1 = "find_instances" ]; then
	dns-sd -B _zotero._tcp local. > /tmp/zoteroconf_instances &

elif [ $1 = "kill_find_instances" ]; then
	PIDs=`ps x | grep "dns-sd -B" | grep _zotero._tcp | sed -E 's/ *([0-9]+).*/\1/' | xargs`
	if [ "$PIDs" ]; then
		kill $PIDs
	fi

elif [ $1 = "get_info" ]; then
	if [ ! "$2" ]; then
		echo "Service name not specified"
		exit 1
	fi
	
	if [ ! "$3" ]; then
		echo "Temp file path not specified"
		exit 1
	fi
	
	#dns-sd -L "$2" _zotero._tcp local. > $3 &
	mDNS -L "$2" _zotero._tcp local. > $3 &

elif [ $1 = "kill_get_info" ]; then
	#PIDs=`ps x | grep "dns-sd -L" | grep _zotero._tcp | sed -E 's/ *([0-9]+).*/\1/' | xargs`
	PIDs=`ps x | grep "mDNS -L" | grep _zotero._tcp | sed -E 's/ *([0-9]+).*/\1/' | xargs`
	if [ "$PIDs" ]; then
		kill $PIDs
	fi

elif [ $1 = "kill_service" ]; then
	PIDs=`ps x | grep dns-sd | grep '_zotero._tcp' | sed -E 's/ *([0-9]+).*/\1/' | xargs`
	if [ "$PIDs" ]; then
		kill $PIDs
	fi
fi
