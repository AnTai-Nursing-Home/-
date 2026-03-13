function houseAIToggle(){
  const chat=document.getElementById('houseAIChat');
  chat.style.display = chat.style.display==='flex' ? 'none' : 'flex';
}

function houseAIClose(){
  document.getElementById('houseAIChat').style.display='none';
}

function houseAISend(){
  const input=document.getElementById('houseAIInput');
  const msg=input.value.trim();
  if(!msg) return;

  const container=document.getElementById('houseAIMessages');

  const user=document.createElement('div');
  user.className='house-ai-msg user';
  user.innerText=msg;
  container.appendChild(user);

  const ai=document.createElement('div');
  ai.className='house-ai-msg ai';

  if(msg.includes('205-2')){
    ai.innerText='205-2 阿秀：近期生命徵象穩定，建議持續觀察。';
  }else if(msg.includes('傷口')){
    ai.innerText='目前示範：系統可以查詢進行中的傷口個案。';
  }else if(msg.includes('護理')){
    ai.innerText='護理紀錄草稿：住民今日生命徵象穩定，精神狀況良好。';
  }else{
    ai.innerText='這是示範版 House AI，之後可以接 OpenAI 與 Firebase。';
  }

  container.appendChild(ai);
  container.scrollTop=container.scrollHeight;

  input.value='';
}

document.addEventListener('keypress',function(e){
  if(e.key==='Enter'){
    houseAISend();
  }
});
