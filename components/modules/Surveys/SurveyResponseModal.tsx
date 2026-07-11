import React, { useState } from 'react';
import { Star, GripVertical } from 'lucide-react';
import { Modal, Button, useToast } from '../../ui/Common';
import { Input, Textarea } from '../../ui/Form';
import { Survey } from '../../../services/surveysService';

interface SurveyResponseModalProps {
    survey: Survey;
    onClose: () => void;
    onSubmit: (answers: Record<string, any>) => Promise<void>;
}

export const SurveyResponseModal: React.FC<SurveyResponseModalProps> = ({ survey, onClose, onSubmit }) => {
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required questions
        const requiredQuestions = survey.questions.filter(q => q.required);
        const missingRequired = requiredQuestions.filter(q => !answers[q.id] || answers[q.id] === '');

        if (missingRequired.length > 0) {
            showToast('Please answer all required questions', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(answers);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAnswerChange = (questionId: string, value: any) => {
        setAnswers({ ...answers, [questionId]: value });
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={survey.title} size="lg" drawerOnMobile>
            <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-sm text-slate-600">{survey.description}</p>

                <div className="space-y-6">
                    {survey.questions.map((question, index) => (
                        <div key={question.id} className="space-y-2">
                            <label className="block text-sm font-medium text-slate-900">
                                {index + 1}. {question.question}
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {question.type === 'text' && (
                                <Textarea
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder="Enter your answer..."
                                    required={question.required}
                                    rows={3}
                                />
                            )}

                            {question.type === 'multiple-choice' && question.options && (
                                <div className="space-y-2">
                                    {question.options.map((option, optIndex) => (
                                        <label key={optIndex} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={option}
                                                checked={answers[question.id] === option}
                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                required={question.required}
                                                className="text-jci-blue"
                                            />
                                            <span className="text-sm text-slate-700">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {question.type === 'rating' && (
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(rating => (
                                        <button
                                            key={rating}
                                            type="button"
                                            onClick={() => handleAnswerChange(question.id, rating)}
                                            className={`p-3 rounded-lg border-2 transition-all ${answers[question.id] === rating
                                                ? 'border-jci-blue bg-blue-50 text-jci-blue'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <Star size={24} fill={answers[question.id] === rating ? 'currentColor' : 'none'} />
                                            <span className="block text-xs mt-1">{rating}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {question.type === 'yes-no' && (
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex-1">
                                        <input
                                            type="radio"
                                            name={question.id}
                                            value="yes"
                                            checked={answers[question.id] === 'yes' || answers[question.id] === true}
                                            onChange={() => handleAnswerChange(question.id, 'yes')}
                                            required={question.required}
                                            className="text-jci-blue"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex-1">
                                        <input
                                            type="radio"
                                            name={question.id}
                                            value="no"
                                            checked={answers[question.id] === 'no' || answers[question.id] === false}
                                            onChange={() => handleAnswerChange(question.id, 'no')}
                                            required={question.required}
                                            className="text-jci-blue"
                                        />
                                        <span className="text-sm font-medium text-slate-700">No</span>
                                    </label>
                                </div>
                            )}

                            {question.type === 'date' && (
                                <Input
                                    type="date"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder={question.placeholder || 'Select date...'}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'number' && (
                                <Input
                                    type="number"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, parseFloat(e.target.value) || 0)}
                                    placeholder={question.placeholder || 'Enter number...'}
                                    min={question.min}
                                    max={question.max}
                                    step={question.step}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'email' && (
                                <Input
                                    type="email"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder={question.placeholder || 'Enter email address...'}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'phone' && (
                                <Input
                                    type="tel"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder={question.placeholder || 'Enter phone number...'}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'matrix' && question.matrixRows && question.matrixColumns && (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="border border-slate-300 p-2 text-left text-sm font-medium text-slate-700"></th>
                                                {question.matrixColumns.map((col, colIndex) => (
                                                    <th key={colIndex} className="border border-slate-300 p-2 text-center text-sm font-medium text-slate-700">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {question.matrixRows.map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    <td className="border border-slate-300 p-2 text-sm font-medium text-slate-700">
                                                        {row}
                                                    </td>
                                                    {question.matrixColumns?.map((col, colIndex) => (
                                                        <td key={colIndex} className="border border-slate-300 p-2 text-center">
                                                            <input
                                                                type="radio"
                                                                name={`${question.id}-${rowIndex}`}
                                                                value={col}
                                                                checked={answers[`${question.id}-${rowIndex}`] === col}
                                                                onChange={(e) => handleAnswerChange(`${question.id}-${rowIndex}`, e.target.value)}
                                                                required={question.required}
                                                                className="text-jci-blue"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {question.type === 'ranking' && question.options && (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500 mb-2">Drag to reorder (top = highest priority)</p>
                                    {question.options.map((option, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
                                            <GripVertical className="text-slate-400 cursor-move" size={16} />
                                            <span className="flex-1 text-sm text-slate-700">{option}</span>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={question.options?.length}
                                                value={answers[`${question.id}-${option}`] || (optIndex + 1)}
                                                onChange={(e) => handleAnswerChange(`${question.id}-${option}`, parseInt(e.target.value))}
                                                className="w-16"
                                                required={question.required}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {question.helpText && (
                                <p className="text-xs text-slate-500 italic">{question.helpText}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit Survey'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
