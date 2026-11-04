/** Create a self-contained PDF using browser canvas so Greek text is rendered with the device fonts. */
export async function saveStatementPdf(input:{address:string;month:string;apartment:string;items:{name:string;amount:string}[];total:string;due:string;paid:string;balance:string}):Promise<void>{
 const width=1240, height=1754, margin=90, line=43;
 const pages:HTMLCanvasElement[]=[];let canvas=document.createElement('canvas');const initialContext=canvas.getContext('2d');if(!initialContext)throw new Error('Δεν υποστηρίζεται η δημιουργία PDF σε αυτή τη συσκευή.');let ctx:CanvasRenderingContext2D=initialContext;
 let y=margin;
 const setup=()=>{canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#172333';ctx.textBaseline='top';y=margin;};
 const page=()=>{pages.push(canvas);canvas=document.createElement('canvas');setup();};
 setup();
 const write=(value:string,bold=false,size=27)=>{ctx.font=(bold?'bold ':'')+size+'px Arial, sans-serif';const max=width-2*margin;const words=value.split(/\s+/);let row='';for(const word of words){const next=row?row+' '+word:word;if(ctx.measureText(next).width>max&&row){if(y+line>height-margin)page();ctx.fillText(row,margin,y);y+=line;row=word;}else row=next;}if(y+line>height-margin)page();ctx.fillText(row,margin,y);y+=line;};
 const entry=(label:string,value:string)=>{write(label+' — '+value);};
 write('ΚΟΙΝΟΧΡΗΣΤΑ',true,43);write(input.address);write(input.month,true,31);y+=25;
 write('Αναλυτικές δαπάνες',true,32);
 for(const item of input.items)entry(item.name,item.amount);
 y+=15;entry('Σύνολο πολυκατοικίας',input.total);y+=30;
 write('Διαμέρισμα '+input.apartment,true,32);entry('Χρέωση',input.due);entry('Πληρωμένο',input.paid);entry('Υπόλοιπο',input.balance);
 pages.push(canvas);
 // Encode each page as JPEG and place it on an A4 PDF page without external dependencies.
 const encoder=new TextEncoder();const chunks:Uint8Array[]=[];let offset=0;const offsets:number[]=[0];
 const append=(v:Uint8Array|string)=>{const bytes=typeof v==='string'?encoder.encode(v):v;chunks.push(bytes);offset+=bytes.length;};
 const object=(id:number,body:string|Uint8Array)=>{offsets[id]=offset;append(id+' 0 obj\n');append(body);append('\nendobj\n');};
 const jpgs=pages.map(p=>{const data=p.toDataURL('image/jpeg',0.9).split(',')[1];const raw=atob(data);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;});
 append('%PDF-1.4\n');
 const kids=pages.map((_,i)=>(3+i*3)+' 0 R').join(' ');
 object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Kids ['+kids+'] /Count '+pages.length+' >>');
 for(let i=0;i<pages.length;i++){const base=3+i*3, img=jpgs[i], name='Im'+i;object(base,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /'+name+' '+(base+1)+' 0 R >> >> /Contents '+(base+2)+' 0 R >>');offsets[base+1]=offset;append((base+1)+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+img.length+' >>\nstream\n');append(img);append('\nendstream\nendobj\n');const stream='q 595 0 0 842 0 0 cm /'+name+' Do Q\n';object(base+2,'<< /Length '+encoder.encode(stream).length+' >>\nstream\n'+stream+'endstream');}
 const start=offset;append('xref\n0 '+(3+pages.length*3)+'\n0000000000 65535 f \n');for(let i=1;i<3+pages.length*3;i++)append(String(offsets[i]).padStart(10,'0')+' 00000 n \n');append('trailer\n<< /Size '+(3+pages.length*3)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF');
 const blob=new Blob(chunks as BlobPart[],{type:'application/pdf'});const filename='Koinoxrista-'+input.month+'-'+input.apartment+'.pdf';const file=new File([blob],filename,{type:'application/pdf'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Κοινόχρηστα '+input.month});return;}catch(e){if((e as Error).name==='AbortError')return;}}
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
