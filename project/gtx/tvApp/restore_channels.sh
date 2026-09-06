curl -k -s -X POST "https://tv-z.duckdns.org/api/channels/bulk" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 6zOB0eEupCJeFKimwjtRdgG9X079m21H" \
  -d '{
    "channels": [
      { "name": "3HD", "url": "https://ch3-33-web.cdn.byteark.com/live/playlist.m3u8?x_ark_access_id=D78MkxZFEr5Zr9PE&x_ark_auth_type=ark-v2&x_ark_expires=1788727803&x_ark_max_resolution=1080p&x_ark_path_prefix=/live/&x_ark_signature=WxOH_wlbWLEvT-qj0kjpig", "group": "ฟรีทีวี" },
      { "name": "5HD", "url": "https://639bc5877c5fe.streamlock.net/tv5hdlive/tv5hdlive/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "7HD", "url": "https://live-us1.thaimomo.com/live-as/ch7hd-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "9 MCOT HD", "url": "https://live-us1.thaimomo.com/live-as/chmcothd-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "MONO 29", "url": "https://live-us1.thaimomo.com/live-as/chmono29-2/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "ไทยรัฐทีวี 32", "url": "https://live-us1.thaimomo.com/live-as/chthairathhd-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "One 31", "url": "https://live-us1.thaimomo.com/live-as/chone-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "Amarin TV 34", "url": "https://live-us1.thaimomo.com/live-as/chamarin-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "Workpoint 23", "url": "https://live-us1.thaimomo.com/live-as/chworkpointt-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "GMM 25", "url": "https://live-us1.thaimomo.com/live-as/chgmmchannel-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "Channel 8", "url": "https://live-us1.thaimomo.com/live-as/cheight-3/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "True4U 24", "url": "https://live-us1.thaimomo.com/live-as/chTrue4u-2/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "Thai PBS", "url": "https://live-us1.thaimomo.com/live-as/chThaipbshd-2/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "NBT 2HD", "url": "https://cdn-edge.iiptvcdn.com/live_event/smil:f180-054a-38d7-ce66-f7cf.smil/playlist.m3u8", "group": "ฟรีทีวี" },
      { "name": "Nation TV 22", "url": "https://live-us1.thaimomo.com/live-as/chNation-3/playlist.m3u8", "group": "ข่าว" },
      { "name": "T Sports 7", "url": "https://live-us1.thaimomo.com/live-as/chtsport-1/playlist.m3u8", "group": "กีฬา" }
    ]
  }'