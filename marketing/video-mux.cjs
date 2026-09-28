// Minimal silent, single-track containers for deterministic WebCodecs exports.
const cat=(...b)=>Buffer.concat(b.flat());
function u32(n){const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;}
function u16(n){const b=Buffer.alloc(2);b.writeUInt16BE(n);return b;}
function box(type,...data){const b=cat(...data);return cat(u32(b.length+8),Buffer.from(type),b);}
function full(type,flags,...data){return box(type,u32(flags),...data);}
const matrix=cat(u32(0x10000),u32(0),u32(0),u32(0),u32(0x10000),u32(0),u32(0),u32(0),u32(0x40000000));

function mp4(chunks,description,width,height,fps){
  const timescale=90000,delta=timescale/fps,duration=chunks.length*delta;
  if(!Number.isInteger(delta))throw Error('MP4 timescale must divide the frame rate');
  const ftyp=box('ftyp',Buffer.from('isom'),u32(512),Buffer.from('isomiso2avc1mp41'));
  const avc1=box('avc1',Buffer.alloc(6),u16(1),Buffer.alloc(16),u16(width),u16(height),u32(0x480000),u32(0x480000),u32(0),u16(1),Buffer.alloc(32),u16(24),u16(0xffff),box('avcC',description));
  const moov=offset=>box('moov',
    full('mvhd',0,u32(0),u32(0),u32(timescale),u32(duration),u32(0x10000),u16(0x100),Buffer.alloc(10),matrix,Buffer.alloc(24),u32(2)),
    box('trak',
      full('tkhd',7,u32(0),u32(0),u32(1),u32(0),u32(duration),Buffer.alloc(8),u16(0),u16(0),u16(0),u16(0),matrix,u32(width*65536),u32(height*65536)),
      box('mdia',
        full('mdhd',0,u32(0),u32(0),u32(timescale),u32(duration),u16(0x55c4),u16(0)),
        full('hdlr',0,u32(0),Buffer.from('vide'),Buffer.alloc(12),Buffer.from('VideoHandler\0')),
        box('minf',full('vmhd',1,Buffer.alloc(8)),box('dinf',full('dref',0,u32(1),full('url ',1))),
          box('stbl',full('stsd',0,u32(1),avc1),full('stts',0,u32(1),u32(chunks.length),u32(delta)),
            full('stsc',0,u32(1),u32(1),u32(chunks.length),u32(1)),
            full('stsz',0,u32(0),u32(chunks.length),chunks.map(c=>u32(c.data.length))),
            full('stco',0,u32(1),u32(offset)),
            full('stss',0,u32(chunks.filter(c=>c.key).length),chunks.flatMap((c,i)=>c.key?[u32(i+1)]:[]))
          )
        )
      )
    )
  );
  const initial=moov(0),metadata=moov(ftyp.length+initial.length+8);
  return cat(ftyp,metadata,box('mdat',chunks.map(c=>c.data)));
}

function ebmlId(hex){return Buffer.from(hex,'hex');}
function vint(n){
  for(let size=1;size<=8;size++)if(n<2**(size*7)-1){
    const b=Buffer.alloc(size);let value=BigInt(n);
    for(let i=size-1;i>=0;i--){b[i]=Number(value&255n);value>>=8n;}
    b[0]|=1<<(8-size);return b;
  }
  throw Error('EBML size too large');
}
function unsigned(n){let size=1;while(n>=2**(size*8))size++;const b=Buffer.alloc(size);let value=BigInt(n);for(let i=size-1;i>=0;i--){b[i]=Number(value&255n);value>>=8n;}return b;}
function element(id,...data){const b=cat(...data);return cat(ebmlId(id),vint(b.length),b);}
const uint=(id,n)=>element(id,unsigned(n));
const str=(id,s)=>element(id,Buffer.from(s));
function webm(chunks,width,height,fps){
  const duration=Buffer.alloc(8);duration.writeDoubleBE(chunks.length*1000/fps);
  const header=element('1a45dfa3',uint('4286',1),uint('42f7',1),uint('42f2',4),uint('42f3',8),str('4282','webm'),uint('4287',4),uint('4285',2));
  const info=element('1549a966',uint('2ad7b1',1000000),element('4489',duration),str('4d80','Balloon Bouncer WebCodecs'),str('5741','Balloon Bouncer WebCodecs'));
  const tracks=element('1654ae6b',element('ae',uint('d7',1),uint('73c5',1),uint('83',1),str('86','V_VP9'),uint('23e383',Math.round(1e9/fps)),element('e0',uint('b0',width),uint('ba',height))));
  const clusters=[];
  for(let start=0;start<chunks.length;start+=fps*3){
    const time=Math.round(start*1000/fps),blocks=[];
    for(let i=start;i<Math.min(start+fps*3,chunks.length);i++){
      const h=Buffer.alloc(4);h[0]=0x81;h.writeInt16BE(Math.round(i*1000/fps)-time,1);h[3]=chunks[i].key?0x80:0;
      blocks.push(element('a3',h,chunks[i].data));
    }
    clusters.push(element('1f43b675',uint('e7',time),blocks));
  }
  return cat(header,element('18538067',info,tracks,clusters));
}
module.exports={mp4,webm};
