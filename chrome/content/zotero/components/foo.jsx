import React, { useState } from 'react';

function Foo() {
  // Declare a new state variable, which we'll call "count"
  const [count, setCount] = useState(0);
  Zotero.debug("RUNNING FOO");
  
  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}

module.exports = Foo;