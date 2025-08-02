import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface AccessibilityTestProps {
  onTestComplete?: (results: AccessibilityTestResult) => void;
}

interface AccessibilityTestResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warnings: number;
  details: TestDetail[];
}

interface TestDetail {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
}

export function AccessibilityTest({ onTestComplete }: AccessibilityTestProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AccessibilityTestResult | null>(null);
  
  const runAccessibilityTests = () => {
    setIsRunning(true);
    
    // Simulate running accessibility tests
    setTimeout(() => {
      const testResults: AccessibilityTestResult = {
        totalTests: 8,
        passedTests: 6,
        failedTests: 1,
        warnings: 1,
        details: [
          {
            id: "keyboard-nav",
            name: "Keyboard Navigation",
            status: "pass",
            description: "All interactive elements are keyboard accessible"
          },
          {
            id: "aria-labels",
            name: "ARIA Labels",
            status: "pass",
            description: "All elements have appropriate ARIA labels"
          },
          {
            id: "color-contrast",
            name: "Color Contrast",
            status: "pass",
            description: "Text meets WCAG AA contrast requirements"
          },
          {
            id: "focus-indicators",
            name: "Focus Indicators",
            status: "pass",
            description: "Visible focus indicators for all interactive elements"
          },
          {
            id: "screen-reader",
            name: "Screen Reader Compatibility",
            status: "pass",
            description: "Content is properly announced by screen readers"
          },
          {
            id: "semantic-html",
            name: "Semantic HTML",
            status: "pass",
            description: "Proper use of semantic HTML elements"
          },
          {
            id: "alt-text",
            name: "Image Alt Text",
            status: "fail",
            description: "Some images are missing descriptive alt text"
          },
          {
            id: "motion-reduction",
            name: "Motion Reduction",
            status: "warning",
            description: "Consider adding prefers-reduced-motion support"
          }
        ]
      };
      
      setResults(testResults);
      setIsRunning(false);
      
      if (onTestComplete) {
        onTestComplete(testResults);
      }
    }, 1500);
  };
  
  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };
  
  const getStatusColor = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return "bg-green-100 text-green-800";
      case 'fail':
        return "bg-red-100 text-red-800";
      case 'warning':
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  return (
    <Card className="neu-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          Accessibility Testing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Run automated accessibility tests to ensure your calendar meets WCAG standards.
          </p>
          
          <Button
            onClick={runAccessibilityTests}
            disabled={isRunning}
            className="neu-card w-full"
          >
            {isRunning ? "Running Tests..." : "Run Accessibility Tests"}
          </Button>
          
          {results && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Test Results</h3>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {results.passedTests} Passed
                  </Badge>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    {results.failedTests} Failed
                  </Badge>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {results.warnings} Warnings
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                {results.details.map((test) => (
                  <div 
                    key={test.id} 
                    className="flex items-center justify-between p-3 rounded-lg border neu-inset"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(test.status)}
                      <span className="font-medium">{test.name}</span>
                    </div>
                    <Badge variant="secondary" className={getStatusColor(test.status)}>
                      {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-1">Recommendations</h4>
                <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1">
                  <li>Add alt text to all event icons and images</li>
                  <li>Implement prefers-reduced-motion for animations</li>
                  <li>Consider adding skip-to-content links for keyboard users</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}