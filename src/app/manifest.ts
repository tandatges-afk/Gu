import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest {
  return {
    id:'/',name:'GU - Thuê đồ xinh',short_name:'GU',description:'Quản lý thuê đồ, lịch thuê, kho, khách và giặt đồ trên điện thoại',
    start_url:'/',scope:'/',display:'standalone',background_color:'#f8f7f3',theme_color:'#273c2f',
    lang:'vi',orientation:'portrait-primary',
    icons:[
      {src:'/icons/gu-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'/icons/gu-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
      {src:'/icons/gu-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
    ]
  };
}
