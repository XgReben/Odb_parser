import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUp, History, Code } from "lucide-react"

export default function HomePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-2">PCB Assembly Toolkit</h1>
      <p className="text-xl text-muted-foreground mb-8">Tools for PCB assembly and visualization</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileUp className="mr-2 h-5 w-5" />
              Upload ODB++
            </CardTitle>
            <CardDescription>Upload and process ODB++ files for PCB assembly tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Upload your ODB++ files to visualize PCB components and track assembly progress.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/upload" className="w-full">
              <Button className="w-full">Upload File</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Code className="mr-2 h-5 w-5" />
              ODB++ Parser
            </CardTitle>
            <CardDescription>Parse ODB++ files and view extracted data</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Upload and parse ODB++ files to view components, layers, and board profile data.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/parser" className="w-full">
              <Button className="w-full" variant="outline">
                Open Parser
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="mr-2 h-5 w-5" />
              Board History
            </CardTitle>
            <CardDescription>View previously uploaded PCB boards</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Access your previously uploaded PCB boards and continue tracking assembly progress.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/history" className="w-full">
              <Button className="w-full" variant="outline">
                View History
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
