import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'

function App() {


  return (
    <>
      <Routes>
        <Route path="/" element={<h1>Home </h1>} />
        <Route path="/draw" element={<h1>Draw</h1>} />
      </Routes>
    </>
  )
}

export default App
