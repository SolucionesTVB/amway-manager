export default function Toast({ msg, type }) {
  return (
    <div style={{
      position   : 'fixed', bottom : 24, right : 24, zIndex : 9999,
      background : type === 'success' ? '#166534' : '#7f1d1d',
      color      : 'white', padding : '12px 20px', borderRadius : 10,
      boxShadow  : '0 4px 20px rgba(0,0,0,0.5)',
      fontSize   : 14, fontFamily : 'sans-serif',
      animation  : 'slideIn 0.3s ease',
    }}>
      {msg}
    </div>
  )
}
