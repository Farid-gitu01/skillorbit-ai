import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

const app = express()

app.use(helmet())

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'SkillOrbit AI API is running!'
  })
})

export default app