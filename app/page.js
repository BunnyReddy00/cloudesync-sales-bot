// Load Vapi Web SDK script dynamically with live transcript config
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.vapiSDK?.run({
        apiKey: '63c6ac0f-820b-4cd9-9cb2-c7356491ae85', // Your Vapi Public Key
        assistant: '7e379781-ecca-4f5a-98fc-47aba2c2fc44', // Your Vapi Assistant ID
        config: {
          // Enable visual indicators/transcripts if supported by your widget version
          position: "bottom-right",
          语言: "en"
        }
      });
    };
    document.body.appendChild(script);
  }, []);